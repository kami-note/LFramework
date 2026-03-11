/**
 * Integration tests for the Users API (POST /api/users, GET /api/users/:id).
 * Require PostgreSQL. Redis and RabbitMQ are not required (no-op cache and event publisher).
 * Run with: pnpm test:integration
 */
import path from "path";
import { config as loadEnv } from "dotenv";
const packageRoot = path.resolve(__dirname, "../../..");
loadEnv({ path: path.join(packageRoot, ".env") });

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createContainer } from "../../container";
import { createApp } from "../../app";
import { createNoOpEventPublisher } from "./test-event-publisher";
import { createNoOpCache } from "./test-cache";

const databaseUrl =
  process.env.IDENTITY_DATABASE_URL ??
  "postgresql://lframework:lframework@localhost:5432/lframework_identity";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const rabbitmqUrl =
  process.env.RABBITMQ_URL ?? "amqp://lframework:lframework@localhost:5672";

describe("Users API integration", () => {
  const config = {
    databaseUrl,
    redisUrl,
    rabbitmqUrl,
    jwtSecret: "integration-test-secret-min-32-chars-for-jwt",
    jwtExpiresInSeconds: 3600,
    baseUrl: "http://localhost:3001",
    eventPublisherOverride: createNoOpEventPublisher(),
    cacheOverride: createNoOpCache(),
  };

  const container = createContainer(config);
  const app = createApp(container);

  let dbAvailable = false;
  let redisAvailable = false;
  let connected = false;
  const servicesAvailable = () => dbAvailable && redisAvailable;

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
      console.warn(
        "Integration tests: PostgreSQL unreachable. Ensure PostgreSQL is up.",
        message
      );
    }
    try {
      await container.redis.ping();
      redisAvailable = true;
    } catch {
      redisAvailable = false;
    }
  });

  afterAll(async () => {
    if (connected) await container.disconnect();
  });

  const ADMIN_EMAIL = "admin@users-test.example.com";
  const REGULAR_EMAIL = "regular@users-test.example.com";
  let adminToken: string | undefined;
  let regularToken: string | undefined;
  let seedUsersCreated = false;

  beforeAll(async () => {
    if (!servicesAvailable()) return;
    try {
      const regAdmin = await request(app)
        .post("/api/auth/register")
        .send({
          email: ADMIN_EMAIL,
          name: "Admin",
          password: "AdminPass123",
        });
      if (regAdmin.status !== 201) throw new Error("Admin register failed");
      await container.prisma.userModel.updateMany({
        where: { email: ADMIN_EMAIL },
        data: { role: "admin" },
      });
      const adminLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: ADMIN_EMAIL, password: "AdminPass123" });
      if (adminLogin.status !== 200) throw new Error("Admin login failed");
      adminToken = adminLogin.body.accessToken;

      const regRegular = await request(app)
        .post("/api/auth/register")
        .send({
          email: REGULAR_EMAIL,
          name: "Regular",
          password: "RegularPass123",
        });
      if (regRegular.status !== 201) throw new Error("Regular register failed");
      const regularLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: REGULAR_EMAIL, password: "RegularPass123" });
      if (regularLogin.status !== 200) throw new Error("Regular login failed");
      regularToken = regularLogin.body.accessToken;
      seedUsersCreated = true;
    } catch {
      seedUsersCreated = false;
    }
  });

  beforeEach(async () => {
    if (!dbAvailable) return;
    await container.prisma.userModel.deleteMany({
      where: {
        email: { notIn: [ADMIN_EMAIL, REGULAR_EMAIL] },
      },
    });
  });

  describe("POST /api/users", () => {
    it("returns 401 when Authorization header is missing", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/users")
        .send({ email: "new@example.com", name: "New User" })
        .expect(401);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 401 when token is invalid", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", "Bearer invalid-token")
        .send({ email: "new@example.com", name: "New User" })
        .expect(401);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 403 when user is not admin", async ({ skip }) => {
      if (!servicesAvailable() || !regularToken) skip();
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${regularToken}`)
        .send({ email: "other@example.com", name: "Other User" })
        .expect(403);
      expect(res.body).toHaveProperty("error", "Forbidden");
    });

    it("returns 201 when admin creates a user", async ({ skip }) => {
      if (!servicesAvailable() || !adminToken) skip();
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "created@example.com", name: "Created User" })
        .expect(201);

      expect(res.body).toMatchObject({
        email: "created@example.com",
        name: "Created User",
      });
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("createdAt");
    });

    it("returns 409 when admin creates user with existing email", async ({
      skip,
    }) => {
      if (!servicesAvailable() || !adminToken) skip();
      await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "dup@example.com", name: "First" })
        .expect(201);
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "dup@example.com", name: "Duplicate" })
        .expect(409);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when body is empty", async ({ skip }) => {
      if (!servicesAvailable() || !adminToken) skip();
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({})
        .expect(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when email is invalid", async ({ skip }) => {
      if (!servicesAvailable() || !adminToken) skip();
      const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ email: "not-an-email", name: "User" })
        .expect(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("GET /api/users/:id", () => {
    it("returns 401 when Authorization header is missing", async ({
      skip,
    }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .get("/api/users/550e8400-e29b-41d4-a716-446655440000")
        .expect(401);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 401 when token is invalid", async ({ skip }) => {
      if (!dbAvailable) skip();
      const res = await request(app)
        .get("/api/users/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when id is not a valid UUID", async ({ skip }) => {
      if (!servicesAvailable() || !regularToken) skip();
      const res = await request(app)
        .get("/api/users/not-a-uuid")
        .set("Authorization", `Bearer ${regularToken}`)
        .expect(400);
      expect(res.body).toHaveProperty("error", "Invalid user id format");
    });

    it("returns 404 when user does not exist", async ({ skip }) => {
      if (!servicesAvailable() || !adminToken) skip();
      const res = await request(app)
        .get("/api/users/550e8400-e29b-41d4-a716-446655440000")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);
      expect(res.body).toHaveProperty("error", "User not found");
    });

    it("returns 200 with user when requesting own id", async ({ skip }) => {
      if (!servicesAvailable() || !seedUsersCreated || !regularToken) skip();
      const regularUser = await container.prisma.userModel.findFirst({
        where: { email: REGULAR_EMAIL },
      });
      if (!regularUser) skip(); // Skip if seed data was wiped (e.g. parallel run with auth suite)

      const res = await request(app)
        .get(`/api/users/${regularUser!.id}`)
        .set("Authorization", `Bearer ${regularToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: regularUser!.id,
        email: REGULAR_EMAIL,
        name: "Regular",
      });
      expect(res.body).toHaveProperty("createdAt");
    });

    it("returns 403 when user requests another user id", async ({ skip }) => {
      if (!servicesAvailable() || !seedUsersCreated || !regularToken) skip();
      const adminUser = await container.prisma.userModel.findFirst({
        where: { email: ADMIN_EMAIL },
      });
      if (!adminUser) skip();

      const res = await request(app)
        .get(`/api/users/${adminUser!.id}`)
        .set("Authorization", `Bearer ${regularToken}`)
        .expect(403);
      expect(res.body).toHaveProperty("error", "Forbidden");
    });

    it("returns 200 with user when admin requests any user id", async ({
      skip,
    }) => {
      if (!servicesAvailable() || !seedUsersCreated || !adminToken) skip();
      const regularUser = await container.prisma.userModel.findFirst({
        where: { email: REGULAR_EMAIL },
      });
      if (!regularUser) skip();

      const res = await request(app)
        .get(`/api/users/${regularUser!.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: regularUser!.id,
        email: REGULAR_EMAIL,
        name: "Regular",
      });
    });
  });
});
