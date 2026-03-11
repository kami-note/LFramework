/**
 * Integration tests for Data Replication: HandleUserCreatedUseCase upserts into replicated_users.
 * Requires PostgreSQL (replicated_users table). Redis uses no-op override.
 */
import path from "path";
import { config as loadEnv } from "dotenv";
const packageRoot = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(packageRoot, ".env") });

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createContainer } from "../../container";
import { createNoOpCache } from "./test-cache";
import { createNoOpEventConsumer } from "./test-event-consumer";

const databaseUrl =
  process.env.CATALOG_DATABASE_URL ??
  "postgresql://lframework:lframework@localhost:5432/lframework";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const rabbitmqUrl =
  process.env.RABBITMQ_URL ?? "amqp://lframework:lframework@localhost:5672";
const jwtSecret =
  process.env.JWT_SECRET ?? "integration-test-secret-min-32-chars";

describe("Data replication integration", () => {
  const config = {
    databaseUrl,
    redisUrl,
    rabbitmqUrl,
    jwtSecret: jwtSecret.length >= 32 ? jwtSecret : "integration-test-secret-min-32-chars-for-jwt",
    cacheOverride: createNoOpCache(),
    eventConsumerOverride: createNoOpEventConsumer(),
  };

  const container = createContainer(config);
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await container.connectRabbitMQ(async () => {});
    } catch {
      // use override
    }
    try {
      await container.prisma.$connect();
      await container.prisma.replicatedUserModel.deleteMany({});
      dbAvailable = true;
    } catch (err) {
      dbAvailable = false;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        "Replication integration: PostgreSQL unreachable or replicated_users missing. Run prisma migrate.",
        message
      );
    }
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    if (!dbAvailable) return;
    await container.prisma.replicatedUserModel.deleteMany({});
  });

  it("upserts replicated user when HandleUserCreatedUseCase receives payload", async ({ skip }) => {
    if (!dbAvailable) skip();

    const payload = {
      userId: "repl-user-1",
      email: "repl@example.com",
      name: "Replicated User",
      occurredAt: "2025-03-01T14:00:00.000Z",
    };

    await container.handleUserCreatedUseCase.execute(payload);

    const row = await container.prisma.replicatedUserModel.findUnique({
      where: { id: payload.userId },
    });
    expect(row).not.toBeNull();
    expect(row!.email).toBe(payload.email);
    expect(row!.name).toBe(payload.name);
    expect(row!.createdAt).toEqual(new Date(payload.occurredAt));
    expect(row!.lastEventAt).toBeInstanceOf(Date);
  });

  it("updates existing replicated user on second event (same id)", async ({ skip }) => {
    if (!dbAvailable) skip();

    const payload1 = {
      userId: "repl-user-2",
      email: "first@example.com",
      name: "First Name",
      occurredAt: "2025-03-01T10:00:00.000Z",
    };
    await container.handleUserCreatedUseCase.execute(payload1);

    const payload2 = {
      userId: "repl-user-2",
      email: "updated@example.com",
      name: "Updated Name",
      occurredAt: "2025-03-01T12:00:00.000Z",
    };
    await container.handleUserCreatedUseCase.execute(payload2);

    const row = await container.prisma.replicatedUserModel.findUnique({
      where: { id: "repl-user-2" },
    });
    expect(row).not.toBeNull();
    expect(row!.email).toBe("updated@example.com");
    expect(row!.name).toBe("Updated Name");
    expect(row!.createdAt).toEqual(new Date(payload1.occurredAt));
  });
});
