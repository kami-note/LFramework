import express from "express";
import cors from "cors";
import { createContainer } from "./container";
import {
  requestIdMiddleware,
  createErrorHandlerMiddleware,
  createHealthHandler,
  logger,
} from "@lframework/shared";

const port = parseInt(process.env.IDENTITY_SERVICE_PORT ?? "3001", 10);
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.IDENTITY_DATABASE_URL) {
  logger.error("IDENTITY_DATABASE_URL must be set in production");
  process.exit(1);
}
if (isProduction && !process.env.REDIS_URL) {
  logger.error("REDIS_URL must be set in production");
  process.exit(1);
}
if (isProduction && !process.env.RABBITMQ_URL) {
  logger.error("RABBITMQ_URL must be set in production");
  process.exit(1);
}

const databaseUrl = process.env.IDENTITY_DATABASE_URL ?? "postgresql://lframework:lframework@localhost:5432/lframework_identity";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const rabbitmqUrl = process.env.RABBITMQ_URL ?? "amqp://lframework:lframework@localhost:5672";
const jwtSecret = process.env.JWT_SECRET ?? (isProduction ? "" : "dev-secret-min-32-chars-for-jwt-signing");
const jwtExpiresInSeconds = parseInt(process.env.JWT_EXPIRES_IN_SECONDS ?? "604800", 10); // 7 days
const baseUrl = process.env.BASE_URL ?? `http://localhost:${port}`;

if (isProduction && (!jwtSecret || jwtSecret.length < 32)) {
  logger.error("JWT_SECRET must be set and at least 32 characters in production");
  process.exit(1);
}

const googleOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
  : undefined;
const githubOAuth = process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
  : undefined;

async function bootstrap() {
  const container = createContainer({
    databaseUrl,
    redisUrl,
    rabbitmqUrl,
    jwtSecret,
    jwtExpiresInSeconds,
    baseUrl,
    googleOAuth,
    githubOAuth,
  });

  await container.connectRabbitMQ();

  const app = express();
  app.use(requestIdMiddleware);
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    app.use(
      cors({
        origin: corsOrigin.split(",").map((s) => s.trim()),
        credentials: true,
      })
    );
  }
  app.use(express.json({ limit: "512kb" }));
  app.use("/api", container.userRoutes);
  app.use("/api", container.authRoutes);

  app.get("/health", createHealthHandler("identity-service"));

  app.use(createErrorHandlerMiddleware(container.mapApplicationErrorToHttp));

  app.listen(port, () => {
    logger.info(`Identity service listening on http://localhost:${port}`);
  });

  process.on("SIGTERM", async () => {
    await container.disconnect();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start identity-service");
  process.exit(1);
});
