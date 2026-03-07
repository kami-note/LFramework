import { createContainer as createAwilixContainer, asValue, asClass, asFunction } from "awilix";
import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import type { UserCreatedPayload } from "@lframework/shared";
import { RedisCacheAdapter, createAuthMiddleware, JwtTokenVerifier } from "@lframework/shared";
import { PrismaItemRepository } from "./infrastructure/adapters/out/persistence/prisma-item.repository";
import { ItemsListCacheInvalidatorAdapter } from "./infrastructure/adapters/out/cache/items-list-cache-invalidator.adapter";
import { RabbitMqUserEventsAdapter } from "./infrastructure/adapters/in/messaging/rabbitmq-user-events.adapter";
import { CreateItemUseCase } from "./application/use-cases/create-item.use-case";
import { ListItemsUseCase } from "./application/use-cases/list-items.use-case";
import { HandleUserCreatedUseCase } from "./application/use-cases/handle-user-created.use-case";
import { ItemController } from "./infrastructure/adapters/in/http/item.controller";
import { createItemRoutes } from "./infrastructure/adapters/in/http/routes";
import { mapApplicationErrorToHttp } from "./infrastructure/adapters/in/http/error-to-http.mapper";

export interface CatalogContainerConfig {
  databaseUrl: string;
  redisUrl: string;
  rabbitmqUrl: string;
  jwtSecret: string;
}

/** Tipo do cradle (dependências resolvidas) para type-safety. */
interface CatalogCradle {
  config: CatalogContainerConfig;
  prisma: PrismaClient;
  redis: Redis;
  cache: RedisCacheAdapter;
  itemRepository: PrismaItemRepository;
  itemsListCacheInvalidator: ItemsListCacheInvalidatorAdapter;
  createItemUseCase: CreateItemUseCase;
  listItemsUseCase: ListItemsUseCase;
  handleUserCreatedUseCase: HandleUserCreatedUseCase;
  itemController: ItemController;
  tokenVerifier: JwtTokenVerifier;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
  itemRoutes: ReturnType<typeof createItemRoutes>;
  eventConsumer: RabbitMqUserEventsAdapter;
}

/**
 * Container de DI com Awilix.
 * Dependências registradas por nome; resolução automática por parâmetros do construtor.
 */
export function createContainer(config: CatalogContainerConfig) {
  const awilix = createAwilixContainer<CatalogCradle>();

  awilix.register({
    config: asValue(config),

    prisma: asFunction(({ config }: { config: CatalogContainerConfig }) => {
      return new PrismaClient({
        datasources: { db: { url: config.databaseUrl } },
      });
    }).singleton(),

    redis: asFunction(({ config }: { config: CatalogContainerConfig }) => {
      return new Redis(config.redisUrl, {
        connectTimeout: 5000,
        commandTimeout: 5000,
      });
    }).singleton(),

    cache: asClass(RedisCacheAdapter).singleton(),
    itemRepository: asClass(PrismaItemRepository).singleton(),
    itemsListCacheInvalidator: asClass(ItemsListCacheInvalidatorAdapter).singleton(),

    createItemUseCase: asClass(CreateItemUseCase).singleton(),
    listItemsUseCase: asClass(ListItemsUseCase).singleton(),
    handleUserCreatedUseCase: asClass(HandleUserCreatedUseCase).singleton(),

    itemController: asClass(ItemController).singleton(),

    tokenVerifier: asFunction(({ config }: { config: CatalogContainerConfig }) => {
      return new JwtTokenVerifier(config.jwtSecret);
    }).singleton(),

    authMiddleware: asFunction(
      ({ tokenVerifier }: { tokenVerifier: JwtTokenVerifier }) =>
        createAuthMiddleware((token) => tokenVerifier.verify(token))
    ).singleton(),

    itemRoutes: asFunction(
      ({
        itemController,
        authMiddleware,
      }: {
        itemController: ItemController;
        authMiddleware: ReturnType<typeof createAuthMiddleware>;
      }) => createItemRoutes(itemController, authMiddleware)
    ).singleton(),

    eventConsumer: asFunction(
      ({ config }: { config: CatalogContainerConfig }) =>
        new RabbitMqUserEventsAdapter(config.rabbitmqUrl)
    ).singleton(),
  });

  const c = awilix.cradle;

  return {
    get prisma() {
      return c.prisma;
    },
    get redis() {
      return c.redis;
    },
    get itemRoutes() {
      return c.itemRoutes;
    },
    mapApplicationErrorToHttp,
    get handleUserCreatedUseCase() {
      return c.handleUserCreatedUseCase;
    },
    async connectRabbitMQ(userCreatedHandler: (payload: UserCreatedPayload) => Promise<void>): Promise<void> {
      c.eventConsumer.onUserCreated(userCreatedHandler);
      await c.eventConsumer.start();
    },
    async disconnect(): Promise<void> {
      await c.eventConsumer.close();
      await c.prisma.$disconnect();
      c.redis.disconnect();
    },
  };
}
