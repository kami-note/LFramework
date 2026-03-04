import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import type { UserCreatedPayload } from "@lframework/shared";
import { RedisCacheAdapter } from "@lframework/shared";
import { PrismaItemRepository } from "./infrastructure/persistence/prisma-item.repository";
import { RabbitMqUserEventsAdapter } from "./infrastructure/messaging/rabbitmq-user-events.adapter";
import { CreateItemUseCase } from "./application/use-cases/create-item.use-case";
import { ListItemsUseCase } from "./application/use-cases/list-items.use-case";
import { HandleUserCreatedUseCase } from "./application/use-cases/handle-user-created.use-case";
import { ItemController } from "./infrastructure/http/item.controller";
import { createItemRoutes } from "./infrastructure/http/routes";
import jwt from "jsonwebtoken";
import { createAuthMiddleware } from "@lframework/shared";

export function createContainer(config: {
  databaseUrl: string;
  redisUrl: string;
  rabbitmqUrl: string;
  jwtSecret: string;
}) {
  const prisma = new PrismaClient({
    datasources: { db: { url: config.databaseUrl } },
  });
  const redis = new Redis(config.redisUrl);

  const itemRepository = new PrismaItemRepository(prisma);
  const cache = new RedisCacheAdapter(redis);

  const createItemUseCase = new CreateItemUseCase(itemRepository, cache);
  const listItemsUseCase = new ListItemsUseCase(itemRepository, cache);
  const handleUserCreatedUseCase = new HandleUserCreatedUseCase(cache);

  const itemController = new ItemController(createItemUseCase, listItemsUseCase);
  const authMiddleware = createAuthMiddleware((token) => {
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        algorithms: ["HS256"],
      }) as { sub?: string };
      return decoded.sub ? { sub: decoded.sub } : null;
    } catch {
      return null;
    }
  });
  const itemRoutes = createItemRoutes(itemController, authMiddleware);

  const eventConsumer: RabbitMqUserEventsAdapter = new RabbitMqUserEventsAdapter(config.rabbitmqUrl);

  return {
    prisma,
    redis,
    itemRoutes,
    handleUserCreatedUseCase,
    async connectRabbitMQ(userCreatedHandler: (payload: UserCreatedPayload) => Promise<void>): Promise<void> {
      eventConsumer.onUserCreated(userCreatedHandler);
      await eventConsumer.start();
    },
    async disconnect(): Promise<void> {
      await eventConsumer.close();
      await prisma.$disconnect();
      redis.disconnect();
    },
  };
}
