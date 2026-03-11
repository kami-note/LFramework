/**
 * Integration tests for the Catalog API (GET/POST /api/items, health).
 * Require PostgreSQL. Redis and RabbitMQ are not required (tests use no-op cache and event consumer).
 * Run with: pnpm test:integration
 * If the database is not available, the suite is skipped (no failure).
 * To run against a real DB: copy .env.example to .env, create DB and run pnpm prisma:migrate.
 */
import path from "path";
import { config as loadEnv } from "dotenv";
const packageRoot = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(packageRoot, ".env") });

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createContainer } from "../../container";
import { createApp } from "../../app";
import { createNoOpCache } from "./test-cache";
import { createNoOpEventConsumer } from "./test-event-consumer";

const databaseUrl =
  process.env.CATALOG_DATABASE_URL ??
  "postgresql://lframework:lframework@localhost:5432/lframework";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const rabbitmqUrl =
  process.env.RABBITMQ_URL ?? "amqp://lframework:lframework@localhost:5672";
const jwtSecret =
  process.env.JWT_SECRET ?? "integration-test-secret-min-32-chars-for-jwt";

describe("Catalog API integration", () => {
  const config = {
    databaseUrl,
    redisUrl,
    rabbitmqUrl,
    jwtSecret: jwtSecret.length >= 32 ? jwtSecret : "integration-test-secret-min-32-chars-for-jwt",
    cacheOverride: createNoOpCache(),
    eventConsumerOverride: createNoOpEventConsumer(),
  };

  const container = createContainer(config);
  const app = createApp(container, { baseUrl: "http://localhost:3002" });

  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await container.connectRabbitMQ(async () => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        "Integration tests: RabbitMQ unreachable. Suite uses eventConsumerOverride.",
        message
      );
    }
    try {
      await container.prisma.$connect();
      await container.prisma.itemModel.deleteMany({});
      dbAvailable = true;
    } catch (err) {
      dbAvailable = false;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        "Integration tests: PostgreSQL unreachable. Ensure PostgreSQL is up and .env has CATALOG_DATABASE_URL.",
        message
      );
    }
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    if (!dbAvailable) return;
    await container.prisma.itemModel.deleteMany({});
  });

  function validToken(): string {
    return jwt.sign(
      { sub: "test-user-id" },
      config.jwtSecret,
      { algorithm: "HS256" }
    );
  }

  describe("GET /api/items", () => {
    it("returns 200 with empty array when no items exist", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app).get("/api/items").expect(200);
      expect(res.body).toEqual([]);
    });

    it("returns 200 with items after creating one", async ({ skip }) => {
      if (!dbAvailable) skip();
      await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({ name: "Widget", priceAmount: 1000, priceCurrency: "BRL" })
        .expect(201);

      const res = await request(app).get("/api/items").expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        name: "Widget",
        priceAmount: 1000,
        priceCurrency: "BRL",
      });
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("createdAt");
    });

    it("returns 200 with multiple items in descending createdAt order (newest first)", async ({
      skip,
    }) => {
      if (!dbAvailable) skip();
      await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({ name: "First", priceAmount: 100, priceCurrency: "BRL" })
        .expect(201);
      await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({ name: "Second", priceAmount: 200, priceCurrency: "BRL" })
        .expect(201);

      const res = await request(app).get("/api/items").expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe("Second");
      expect(res.body[1].name).toBe("First");
    });

    it("returns items with valid shape (id uuid, name, priceAmount, priceCurrency, createdAt ISO)", async ({
      skip,
    }) => {
      if (!dbAvailable) skip();
      const created = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({ name: "Shape Test", priceAmount: 0, priceCurrency: "EUR" })
        .expect(201);

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(created.body.id).toMatch(uuidRegex);
      expect(created.body.name).toBe("Shape Test");
      expect(created.body.priceAmount).toBe(0);
      expect(created.body.priceCurrency).toBe("EUR");
      expect(created.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      const listRes = await request(app).get("/api/items").expect(200);
      const item = listRes.body.find((i: { name: string }) => i.name === "Shape Test");
      expect(item).toBeDefined();
      expect(item.id).toMatch(uuidRegex);
      expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("POST /api/items", () => {
    it("returns 401 when Authorization header is missing", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .send({ name: "Item", priceAmount: 500, priceCurrency: "BRL" })
        .expect(401);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 401 when token is invalid", async ({ skip }) => {
      if (!dbAvailable) skip();
      await request(app)
        .post("/api/items")
        .set("Authorization", "Bearer invalid-token")
        .send({ name: "Item", priceAmount: 500, priceCurrency: "BRL" })
        .expect(401);
    });

    it("returns 401 when Authorization header has no Bearer prefix", async ({
      skip,
    }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .set("Authorization", validToken())
        .send({ name: "Item", priceAmount: 500, priceCurrency: "BRL" })
        .expect(401);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 201 with created item when payload is valid and token is valid", async ({
      skip,
    }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({
          name: "Test Item",
          priceAmount: 1999,
          priceCurrency: "USD",
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: "Test Item",
        priceAmount: 1999,
        priceCurrency: "USD",
      });
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("createdAt");
    });

    it("returns 201 with default priceCurrency BRL when omitted", async ({
      skip,
    }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({ name: "Default Currency", priceAmount: 500 })
        .expect(201);
      expect(res.body.priceCurrency).toBe("BRL");
    });

    it("returns 400 when name is missing", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({ priceAmount: 100, priceCurrency: "BRL" })
        .expect(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when priceAmount is negative", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({ name: "Item", priceAmount: -1, priceCurrency: "BRL" })
        .expect(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when body is empty", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({})
        .expect(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when priceCurrency is unsupported", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({ name: "Item", priceAmount: 100, priceCurrency: "XXX" })
        .expect(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when name is only whitespace", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({ name: "   ", priceAmount: 100, priceCurrency: "BRL" })
        .expect(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when name contains invalid characters", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({ name: "Item<script>", priceAmount: 100, priceCurrency: "BRL" })
        .expect(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when priceAmount exceeds maximum", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/items")
        .set("Authorization", `Bearer ${validToken()}`)
        .send({
          name: "Item",
          priceAmount: 1_000_000_000,
          priceCurrency: "BRL",
        })
        .expect(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("GET /health", () => {
    it("returns 200 with service name and status ok (does not require DB)", async () => {
      const res = await request(app).get("/health").expect(200);
      expect(res.body).toMatchObject({
        status: "ok",
        service: "catalog-service",
      });
    });
  });
});
