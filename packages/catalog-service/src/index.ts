import express from "express";
import { createContainer } from "./container";
import {
  requestIdMiddleware,
  errorHandlerMiddleware,
  createHealthHandler,
  logger,
} from "@lframework/shared";

const port = parseInt(process.env.CATALOG_SERVICE_PORT ?? "3002", 10);
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.CATALOG_DATABASE_URL) {
  logger.error("CATALOG_DATABASE_URL must be set in production");
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
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  logger.error("JWT_SECRET must be set and at least 32 characters in production");
  process.exit(1);
}

const databaseUrl =
  process.env.CATALOG_DATABASE_URL ??
  "postgresql://lframework:lframework@localhost:5432/lframework";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const rabbitmqUrl =
  process.env.RABBITMQ_URL ?? "amqp://lframework:lframework@localhost:5672";
const jwtSecret = process.env.JWT_SECRET ?? (isProduction ? "" : "dev-secret-min-32-chars-for-jwt-signing");

async function bootstrap() {
  const container = createContainer({
    databaseUrl,
    redisUrl,
    rabbitmqUrl,
    jwtSecret,
  });

  await container.connectRabbitMQ((payload) =>
    container.handleUserCreatedUseCase.execute(payload)
  );

  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "512kb" }));
  app.use("/api", container.itemRoutes);

  app.get("/health", createHealthHandler("catalog-service"));

  app.use(errorHandlerMiddleware);

  app.listen(port, () => {
    logger.info(`Catalog service listening on http://localhost:${port}`);
  });

  process.on("SIGTERM", async () => {
    await container.disconnect();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start catalog-service");
  process.exit(1);
});
