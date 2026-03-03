import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import amqp from "amqplib";
import { PrismaItemRepository } from "./infrastructure/persistence/prisma-item.repository";
import { RedisCacheAdapter } from "./infrastructure/cache/redis-cache.adapter";
import { RabbitMqUserCreatedConsumer } from "./infrastructure/messaging/rabbitmq-user-created.consumer";
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

  let userCreatedConsumer: RabbitMqUserCreatedConsumer;

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
      const rabbitConnection = await amqp.connect(config.rabbitmqUrl);
      userCreatedConsumer = new RabbitMqUserCreatedConsumer(rabbitConnection);
      userCreatedConsumer.onUserCreated(userCreatedHandler);
      await userCreatedConsumer.start();
    },
    async disconnect(): Promise<void> {
      await prisma.$disconnect();
      redis.disconnect();
    },
  };
}
