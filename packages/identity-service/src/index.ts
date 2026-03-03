import express from "express";
import { createContainer } from "./container";

const port = parseInt(process.env.IDENTITY_SERVICE_PORT ?? "3001", 10);
const databaseUrl = process.env.IDENTITY_DATABASE_URL ?? "postgresql://lframework:lframework@localhost:5432/lframework_identity";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const rabbitmqUrl = process.env.RABBITMQ_URL ?? "amqp://lframework:lframework@localhost:5672";

async function bootstrap() {
  const container = createContainer({
    databaseUrl,
    redisUrl,
    rabbitmqUrl,
  });

  await container.connectRabbitMQ();

  const app = express();
  app.use(express.json());
  app.use("/api", container.userRoutes);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "identity-service" });
  });

  app.listen(port, () => {
    console.log(`Identity service listening on http://localhost:${port}`);
  });

  process.on("SIGTERM", async () => {
    await container.disconnect();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start identity-service:", err);
  process.exit(1);
});
