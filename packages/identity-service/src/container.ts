import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import { RedisCacheAdapter } from "@lframework/shared";
import { PrismaUserRepository } from "./infrastructure/persistence/prisma-user.repository";
import { RabbitMqEventPublisherAdapter } from "./infrastructure/messaging/rabbitmq-event-publisher.adapter";
import { CreateUserUseCase } from "./application/use-cases/create-user.use-case";
import { GetUserByIdUseCase } from "./application/use-cases/get-user-by-id.use-case";
import { UserController } from "./infrastructure/http/user.controller";
import { createUserRoutes } from "./infrastructure/http/routes";

/**
 * Composição de dependências (container simples).
 * Adicione novos use cases e adapters aqui ao estender o projeto.
 */
export function createContainer(config: {
  databaseUrl: string;
  redisUrl: string;
  rabbitmqUrl: string;
}) {
  const prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  const redis = new Redis(config.redisUrl);
  const eventPublisher = new RabbitMqEventPublisherAdapter(config.rabbitmqUrl);

  const userRepository = new PrismaUserRepository(prisma);
  const cache = new RedisCacheAdapter(redis);

  const createUserUseCase = new CreateUserUseCase(userRepository, cache, eventPublisher);
  const getUserByIdUseCase = new GetUserByIdUseCase(userRepository, cache);

  const userController = new UserController(createUserUseCase, getUserByIdUseCase);
  const userRoutes = createUserRoutes(userController);

  return {
    prisma,
    redis,
    userRoutes,
    async connectRabbitMQ(): Promise<void> {
      await eventPublisher.connect();
    },
    async disconnect(): Promise<void> {
      await eventPublisher.disconnect();
      await prisma.$disconnect();
      redis.disconnect();
    },
  };
}
