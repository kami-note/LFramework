import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import { RedisCacheAdapter } from "@lframework/shared";
import { PrismaItemRepository } from "./infrastructure/persistence/prisma-item.repository";
import { RabbitMqUserEventsAdapter } from "./infrastructure/messaging/rabbitmq-user-events.adapter";
import { CreateItemUseCase } from "./application/use-cases/create-item.use-case";
import { ListItemsUseCase } from "./application/use-cases/list-items.use-case";
import { ItemController } from "./infrastructure/http/item.controller";
import { createItemRoutes } from "./infrastructure/http/routes";

export function createContainer(config: {
  databaseUrl: string;
  redisUrl: string;
  rabbitmqUrl: string;
}) {
  const prisma = new PrismaClient({
    datasources: { db: { url: config.databaseUrl } },
  });
  const redis = new Redis(config.redisUrl);

  const itemRepository = new PrismaItemRepository(prisma);
  const cache = new RedisCacheAdapter(redis);

  const createItemUseCase = new CreateItemUseCase(itemRepository, cache);
  const listItemsUseCase = new ListItemsUseCase(itemRepository, cache);

  const itemController = new ItemController(createItemUseCase, listItemsUseCase);
  const itemRoutes = createItemRoutes(itemController);

  const eventConsumer: RabbitMqUserEventsAdapter = new RabbitMqUserEventsAdapter(config.rabbitmqUrl);

  return {
    prisma,
    redis,
    itemRoutes,
    async connectRabbitMQ(
      userCreatedHandler: (payload: {
        userId: string;
        email: string;
        name: string;
      }) => Promise<void>
    ): Promise<void> {
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
