/**
 * Integration tests for the Outbox Pattern: register creates outbox row; relay publishes and marks.
 * Requires PostgreSQL. Redis and RabbitMQ use no-op overrides.
 */
import path from "path";
import { config as loadEnv } from "dotenv";
const packageRoot = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(packageRoot, ".env") });

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createContainer } from "../../container";
import { createApp } from "../../app";
import { createNoOpEventPublisher } from "./test-event-publisher";
import { createNoOpCache } from "./test-cache";
import { OutboxRelayAdapter } from "../../adapters/driven/messaging/outbox-relay.adapter";
import { USER_CREATED_EVENT } from "@lframework/shared";

const databaseUrl =
  process.env.IDENTITY_DATABASE_URL ??
  "postgresql://lframework:lframework@localhost:5432/lframework_identity";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const rabbitmqUrl =
  process.env.RABBITMQ_URL ?? "amqp://lframework:lframework@localhost:5672";

describe("Outbox integration", () => {
  const config = {
    databaseUrl,
    redisUrl,
    rabbitmqUrl,
    jwtSecret: "outbox-test-secret-min-32-chars-for-jwt",
    jwtExpiresInSeconds: 3600,
    baseUrl: "http://localhost:3001",
    eventPublisherOverride: createNoOpEventPublisher(),
    cacheOverride: createNoOpCache(),
  };

  const container = createContainer(config);
  const app = createApp(container);

  let dbAvailable = false;
  let connected = false;

  beforeAll(async () => {
    await container.connectRabbitMQ();
    connected = true;
    try {
      await container.prisma.$connect();
      await container.prisma.outboxModel.deleteMany({});
      await container.prisma.userModel.deleteMany({});
      dbAvailable = true;
    } catch (err) {
      dbAvailable = false;
      const message = err instanceof Error ? err.message : String(err);
      console.warn("Outbox integration: PostgreSQL unreachable.", message);
    }
  });

  afterAll(async () => {
    if (connected) await container.disconnect();
  });

  it("creates outbox row in same transaction as user on register", async ({ skip }) => {
    if (!dbAvailable) skip();

    const email = "outbox-register@example.com";
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email,
        name: "Outbox Register",
        password: "Pass1234",
      })
      .expect(201);

    expect(res.body.user.email).toBe(email);
    const userId = res.body.user.id;

    const user = await container.prisma.userModel.findFirst({
      where: { email },
    });
    expect(user).toBeDefined();

    const outboxRows = await container.prisma.outboxModel.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
    });
    expect(outboxRows.length).toBeGreaterThanOrEqual(1);
    const userCreatedRow = outboxRows.find(
      (r) => r.eventName === USER_CREATED_EVENT && (r.payload as { userId?: string }).userId === userId
    );
    expect(userCreatedRow).toBeDefined();
    expect((userCreatedRow!.payload as { email: string }).email).toBe(email);
  });

  it("relay publishes and marks outbox row when eventPublisher is provided", async ({ skip }) => {
    if (!dbAvailable) skip();

    const published: { eventName: string; payload: object }[] = [];
    const mockPublisher = {
      publish: async (eventName: string, payload: object) => {
        published.push({ eventName, payload });
      },
      connect: async () => {},
      disconnect: async () => {},
    };
    const relay = new OutboxRelayAdapter(
      container.prisma,
      mockPublisher as never,
      50
    );

    const email = "relay-publish@example.com";
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({
        email,
        name: "Relay Publish",
        password: "Pass1234",
      })
      .expect(201);
    const userId = registerRes.body.user.id;

    const unpublished = await container.prisma.outboxModel.findMany({
      where: { eventName: USER_CREATED_EVENT, publishedAt: null },
    });
    const rowBefore = unpublished.find(
      (r) => (r.payload as { userId?: string }).userId === userId
    );
    expect(rowBefore).toBeDefined();

    await relay.runOnce();

    const forThisUser = published.find(
      (p) =>
        p.eventName === USER_CREATED_EVENT &&
        (p.payload as { email: string }).email === email
    );
    expect(forThisUser).toBeDefined();

    const rowAfter = await container.prisma.outboxModel.findUnique({
      where: { id: rowBefore!.id },
    });
    expect(rowAfter).not.toBeNull();
    expect(rowAfter!.publishedAt).not.toBeNull();
  });
});
