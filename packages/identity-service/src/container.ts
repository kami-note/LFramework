import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import amqp from "amqplib";
import { PrismaUserRepository } from "./infrastructure/persistence/prisma-user.repository";
import { RedisCacheAdapter } from "./infrastructure/cache/redis-cache.adapter";
import { RabbitMqEventPublisher } from "./infrastructure/messaging/rabbitmq-event-publisher";
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
  // RabbitMQ connection is async; publisher will be set in bootstrap
  let eventPublisher: RabbitMqEventPublisher;

  const userRepository = new PrismaUserRepository(prisma);
  const cache = new RedisCacheAdapter(redis);

  const createUserUseCase = new CreateUserUseCase(
    userRepository,
    cache,
    { publish: async (name, payload) => eventPublisher.publish(name, payload) }
  );
  const getUserByIdUseCase = new GetUserByIdUseCase(userRepository, cache);

  const userController = new UserController(createUserUseCase, getUserByIdUseCase);
  const userRoutes = createUserRoutes(userController);

  return {
    prisma,
    redis,
    setEventPublisher(publisher: RabbitMqEventPublisher) {
      eventPublisher = publisher;
    },
    userRoutes,
    async connectRabbitMQ(): Promise<void> {
      const conn = await amqp.connect(config.rabbitmqUrl);
      const publisher = new RabbitMqEventPublisher(conn);
      this.setEventPublisher(publisher);
    },
    async disconnect(): Promise<void> {
      await prisma.$disconnect();
      redis.disconnect();
    },
  };
}
