import express from "express";
import { createContainer } from "./container";
import type { HealthResponseDto } from "./infrastructure/http/dtos/health-response.dto";

const port = parseInt(process.env.CATALOG_SERVICE_PORT ?? "3002", 10);
const databaseUrl =
  process.env.CATALOG_DATABASE_URL ??
  "postgresql://lframework:lframework@localhost:5432/lframework";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const rabbitmqUrl =
  process.env.RABBITMQ_URL ?? "amqp://lframework:lframework@localhost:5672";

async function bootstrap() {
  const container = createContainer({
    databaseUrl,
    redisUrl,
    rabbitmqUrl,
  });

  await container.connectRabbitMQ(async (payload) => {
    console.log("[Catalog] UserCreated received:", payload.userId, payload.email);
    // Ponto de extensão: criar dados locais, invalidar cache, etc.
  });

  const app = express();
  app.use(express.json());
  app.use("/api", container.itemRoutes);

  app.get("/health", (_req, res) => {
    const body: HealthResponseDto = { status: "ok", service: "catalog-service" };
    res.json(body);
  });

  app.listen(port, () => {
    console.log(`Catalog service listening on http://localhost:${port}`);
  });

  process.on("SIGTERM", async () => {
    await container.disconnect();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start catalog-service:", err);
  process.exit(1);
});
