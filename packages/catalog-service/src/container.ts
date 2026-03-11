import { createContainer as createAwilixContainer, asValue, asClass, asFunction } from "awilix";
import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import type { UserCreatedPayload } from "@lframework/shared";
import type { ICacheService } from "@lframework/shared";
import { RedisCacheAdapter, createAuthMiddleware, JwtTokenVerifier } from "@lframework/shared";
import { PrismaItemRepository } from "./adapters/driven/persistence/prisma-item.repository";
import { PrismaReplicatedUserStore } from "./adapters/driven/persistence/prisma-replicated-user.store";
import { ItemsListCacheInvalidatorAdapter } from "./adapters/driven/cache/items-list-cache-invalidator.adapter";
import { RabbitMqUserEventsAdapter } from "./adapters/driving/messaging/rabbitmq-user-events.adapter";
import { CreateItemUseCase } from "./application/use-cases/create-item.use-case";
import { ListItemsUseCase } from "./application/use-cases/list-items.use-case";
import { HandleUserCreatedUseCase } from "./application/use-cases/handle-user-created.use-case";
import { ItemController } from "./adapters/driving/http/item.controller";
import { createItemRoutes } from "./adapters/driving/http/routes";
import { mapApplicationErrorToHttp } from "./adapters/driving/http/error-to-http.mapper";

/** No-op event consumer for tests; when set, RabbitMQ is not used. */
export interface TestEventConsumer {
  start(): Promise<void>;
  close(): Promise<void>;
}

export interface CatalogContainerConfig {
  databaseUrl: string;
  redisUrl: string;
  rabbitmqUrl: string;
  jwtSecret: string;
  /** When set, used instead of Redis cache (e.g. no-op in integration tests). */
  cacheOverride?: ICacheService;
  /** When set, used instead of starting RabbitMQ consumer (e.g. no-op in integration tests). */
  eventConsumerOverride?: TestEventConsumer;
}

/** Tipo do cradle (dependências resolvidas) para type-safety. */
interface CatalogCradle {
  config: CatalogContainerConfig;
  prisma: PrismaClient;
  redis: Redis;
  cache: ICacheService;
  itemRepository: PrismaItemRepository;
  replicatedUserStore: PrismaReplicatedUserStore;
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

    cache: asFunction(
      ({ config, redis }: { config: CatalogContainerConfig; redis: Redis }) =>
        config.cacheOverride ?? new RedisCacheAdapter(redis)
    ).singleton(),
    itemRepository: asFunction(
      (cradle: CatalogCradle) => new PrismaItemRepository(cradle.prisma)
    ).singleton(),
    replicatedUserStore: asFunction(
      (cradle: CatalogCradle) => new PrismaReplicatedUserStore(cradle.prisma)
    ).singleton(),
    itemsListCacheInvalidator: asFunction(
      (cradle: CatalogCradle) =>
        new ItemsListCacheInvalidatorAdapter(cradle.cache)
    ).singleton(),

    createItemUseCase: asFunction(
      (cradle: CatalogCradle) =>
        new CreateItemUseCase(cradle.itemRepository, cradle.itemsListCacheInvalidator)
    ).singleton(),
    listItemsUseCase: asFunction(
      (cradle: CatalogCradle) =>
        new ListItemsUseCase(cradle.itemRepository, cradle.cache)
    ).singleton(),
    handleUserCreatedUseCase: asFunction(
      (cradle: CatalogCradle) =>
        new HandleUserCreatedUseCase(cradle.replicatedUserStore, cradle.cache)
    ).singleton(),

    itemController: asFunction(
      (cradle: CatalogCradle) =>
        new ItemController(cradle.createItemUseCase, cradle.listItemsUseCase)
    ).singleton(),

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
  let activeConsumer: { close(): Promise<void> } | null = null;

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
      if (activeConsumer) {
        await activeConsumer.close();
        activeConsumer = null;
      }
      const config = c.config;
      if (config.eventConsumerOverride) {
        await config.eventConsumerOverride.start();
        activeConsumer = config.eventConsumerOverride;
      } else {
        c.eventConsumer.onUserCreated(userCreatedHandler);
        await c.eventConsumer.start();
        activeConsumer = c.eventConsumer;
      }
    },
    async disconnect(): Promise<void> {
      if (activeConsumer) {
        await activeConsumer.close();
        activeConsumer = null;
      }
      await c.prisma.$disconnect();
      c.redis.disconnect();
    },
  };
}
