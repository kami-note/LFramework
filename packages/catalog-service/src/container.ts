import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import type { UserCreatedPayload } from "@lframework/shared";
import { RedisCacheAdapter, createAuthMiddleware, JwtTokenVerifier } from "@lframework/shared";
import { PrismaItemRepository } from "./infrastructure/persistence/prisma-item.repository";
import { ItemsListCacheInvalidatorAdapter } from "./infrastructure/cache/items-list-cache-invalidator.adapter";
import { RabbitMqUserEventsAdapter } from "./infrastructure/messaging/rabbitmq-user-events.adapter";
import { CreateItemUseCase } from "./application/use-cases/create-item.use-case";
import { ListItemsUseCase } from "./application/use-cases/list-items.use-case";
import { HandleUserCreatedUseCase } from "./application/use-cases/handle-user-created.use-case";
import { ItemController } from "./infrastructure/http/item.controller";
import { createItemRoutes } from "./infrastructure/http/routes";
import { mapApplicationErrorToHttp } from "./application/http/error-to-http.mapper";

export function createContainer(config: {
  databaseUrl: string;
  redisUrl: string;
  rabbitmqUrl: string;
  jwtSecret: string;
}) {
  const prisma = new PrismaClient({
    datasources: { db: { url: config.databaseUrl } },
  });
  const redis = new Redis(config.redisUrl, {
    connectTimeout: 5000,
    commandTimeout: 5000,
  });

  const itemRepository = new PrismaItemRepository(prisma);
  const cache = new RedisCacheAdapter(redis);
  const itemsListCacheInvalidator = new ItemsListCacheInvalidatorAdapter(cache);

  const createItemUseCase = new CreateItemUseCase(itemRepository, itemsListCacheInvalidator);
  const listItemsUseCase = new ListItemsUseCase(itemRepository, cache);
  const handleUserCreatedUseCase = new HandleUserCreatedUseCase(cache);

  const itemController = new ItemController(createItemUseCase, listItemsUseCase);
  const tokenVerifier = new JwtTokenVerifier(config.jwtSecret);
  const authMiddleware = createAuthMiddleware((token) => tokenVerifier.verify(token));
  const itemRoutes = createItemRoutes(itemController, authMiddleware);

  const eventConsumer: RabbitMqUserEventsAdapter = new RabbitMqUserEventsAdapter(config.rabbitmqUrl);

  return {
    prisma,
    redis,
    itemRoutes,
    mapApplicationErrorToHttp,
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
