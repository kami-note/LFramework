import { createContainer } from "./container";
import { createApp } from "./app";
import { logger } from "@lframework/shared";

const port = parseInt(process.env.IDENTITY_SERVICE_PORT ?? "3001", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  logger.error("IDENTITY_SERVICE_PORT must be a valid port (1-65535)");
  process.exit(1);
}
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

// Em produção as URLs vêm sempre de variáveis de ambiente (sem default com credenciais).
const databaseUrl = isProduction
  ? process.env.IDENTITY_DATABASE_URL!
  : (process.env.IDENTITY_DATABASE_URL ?? "postgresql://lframework:lframework@localhost:5432/lframework_identity");
const redisUrl = isProduction
  ? process.env.REDIS_URL!
  : (process.env.REDIS_URL ?? "redis://localhost:6379");
const rabbitmqUrl = isProduction
  ? process.env.RABBITMQ_URL!
  : (process.env.RABBITMQ_URL ?? "amqp://lframework:lframework@localhost:5672");
const jwtSecret = process.env.JWT_SECRET ?? (isProduction ? "" : "dev-secret-min-32-chars-for-jwt-signing");
const jwtExpiresInSeconds = parseInt(process.env.JWT_EXPIRES_IN_SECONDS ?? "604800", 10); // 7 days
if (!Number.isInteger(jwtExpiresInSeconds) || jwtExpiresInSeconds < 1) {
  logger.error("JWT_EXPIRES_IN_SECONDS must be a positive integer");
  process.exit(1);
}
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
  const outboxRelayIntervalMs = parseInt(process.env.OUTBOX_RELAY_INTERVAL_MS ?? "2000", 10);
  container.startOutboxRelay(Number.isInteger(outboxRelayIntervalMs) && outboxRelayIntervalMs > 0 ? outboxRelayIntervalMs : 2000);

  const app = createApp(container, {
    corsOrigin: process.env.CORS_ORIGIN,
    baseUrl,
  });

  app.listen(port, () => {
    logger.info(`Identity service listening on http://localhost:${port}`);
  });

  process.on("SIGTERM", async () => {
    try {
      await container.disconnect();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Disconnect failed on SIGTERM");
      process.exit(1);
    }
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start identity-service");
  process.exit(1);
});
