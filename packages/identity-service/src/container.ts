import { createContainer as createAwilixContainer, asValue, asClass, asFunction } from "awilix";
import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import { RedisCacheAdapter, type ICacheService } from "@lframework/shared";
import { PrismaUserRepository } from "./adapters/driven/persistence/prisma-user.repository";
import { PrismaAuthCredentialRepository } from "./adapters/driven/persistence/prisma-auth-credential.repository";
import { PrismaUserRegistrationPersistence } from "./adapters/driven/persistence/prisma-user-registration.repository";
import { PrismaUserOAuthRegistrationPersistence } from "./adapters/driven/persistence/prisma-user-oauth-registration.repository";
import { PrismaOAuthAccountRepository } from "./adapters/driven/persistence/prisma-oauth-account.repository";
import { RabbitMqEventPublisherAdapter } from "./adapters/driven/messaging/rabbitmq-event-publisher.adapter";
import { OutboxRelayAdapter } from "./adapters/driven/messaging/outbox-relay.adapter";
import type { IEventPublisher } from "./application/ports/event-publisher.port";
import { UserCreatedNotifierAdapter } from "./adapters/driven/notifiers/user-created-notifier.adapter";
import { JwtTokenService } from "./adapters/driven/auth/jwt-token.service";
import { Argon2PasswordHasher } from "./adapters/driven/auth/argon2-password-hasher";
import { GoogleOAuthProvider } from "./adapters/driven/auth/google-oauth.provider";
import { GitHubOAuthProvider } from "./adapters/driven/auth/github-oauth.provider";
import type { IOAuthProvider } from "./application/ports/oauth-provider.port";
import { CreateUserUseCase } from "./application/use-cases/create-user.use-case";
import { GetUserByIdUseCase } from "./application/use-cases/get-user-by-id.use-case";
import { RegisterUseCase } from "./application/use-cases/register.use-case";
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { GetCurrentUserUseCase } from "./application/use-cases/get-current-user.use-case";
import { OAuthCallbackUseCase } from "./application/use-cases/oauth-callback.use-case";
import { UserController } from "./adapters/driving/http/user.controller";
import { AuthController } from "./adapters/driving/http/auth.controller";
import { createAuthMiddleware } from "@lframework/shared";
import { createUserRoutes } from "./adapters/driving/http/routes";
import { createAuthRoutes } from "./adapters/driving/http/auth.routes";
import { mapApplicationErrorToHttp } from "./adapters/driving/http/error-to-http.mapper";

/** Optional event publisher for tests (no-op connect/disconnect). When set, RabbitMQ is not used. */
export type TestEventPublisher = IEventPublisher & {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
};

export interface ContainerConfig {
  databaseUrl: string;
  redisUrl: string;
  rabbitmqUrl: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  baseUrl: string;
  googleOAuth?: { clientId: string; clientSecret: string };
  githubOAuth?: { clientId: string; clientSecret: string };
  /** When set, used instead of RabbitMQ (e.g. no-op in integration tests). */
  eventPublisherOverride?: TestEventPublisher;
  /** When set, used instead of Redis cache (e.g. no-op in integration tests). */
  cacheOverride?: ICacheService;
}

/** Tipo do cradle (dependências resolvidas) para type-safety. */
interface IdentityCradle {
  config: ContainerConfig;
  prisma: PrismaClient;
  redis: Redis;
  cache: RedisCacheAdapter;
  userRepository: PrismaUserRepository;
  authCredentialRepository: PrismaAuthCredentialRepository;
  registrationPersistence: PrismaUserRegistrationPersistence;
  userOAuthRegistrationPersistence: PrismaUserOAuthRegistrationPersistence;
  oauthAccountRepository: PrismaOAuthAccountRepository;
  eventPublisher: IEventPublisher & { connect?: () => Promise<void>; disconnect?: () => Promise<void> };
  tokenService: JwtTokenService;
  passwordHasher: Argon2PasswordHasher;
  googleProvider: IOAuthProvider | null;
  githubProvider: IOAuthProvider | null;
  baseUrl: string;
  jwtExpiresInSeconds: number;
  userCreatedNotifier: UserCreatedNotifierAdapter;
  createUserUseCase: CreateUserUseCase;
  getUserByIdUseCase: GetUserByIdUseCase;
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  getCurrentUserUseCase: GetCurrentUserUseCase;
  oauthCallbackUseCase: OAuthCallbackUseCase;
  userController: UserController;
  authController: AuthController;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
  userRoutes: ReturnType<typeof createUserRoutes>;
  authRoutes: ReturnType<typeof createAuthRoutes>;
  outboxRelay: OutboxRelayAdapter;
}

/**
 * Container de DI com Awilix.
 * Dependências registradas por nome; resolução automática por parâmetros do construtor.
 */
export function createContainer(config: ContainerConfig) {
  const awilix = createAwilixContainer<IdentityCradle>();

  awilix.register({
    config: asValue(config),

    prisma: asFunction(({ config }: { config: ContainerConfig }) => {
      return new PrismaClient({ datasources: { db: { url: config.databaseUrl } } });
    }).singleton(),

    redis: asFunction(({ config }: { config: ContainerConfig }) => {
      return new Redis(config.redisUrl, {
        connectTimeout: 5000,
        commandTimeout: 5000,
      });
    }).singleton(),

    cache: asFunction(
    ({ config, redis }: { config: ContainerConfig; redis: Redis }) =>
      config.cacheOverride ?? new RedisCacheAdapter(redis)
  ).singleton(),
    userRepository: asFunction(
      (cradle: IdentityCradle) => new PrismaUserRepository(cradle.prisma)
    ).singleton(),
    authCredentialRepository: asFunction(
      (cradle: IdentityCradle) =>
        new PrismaAuthCredentialRepository(cradle.prisma)
    ).singleton(),
    registrationPersistence: asFunction(
      (cradle: IdentityCradle) =>
        new PrismaUserRegistrationPersistence(cradle.prisma)
    ).singleton(),
    userOAuthRegistrationPersistence: asFunction(
      (cradle: IdentityCradle) =>
        new PrismaUserOAuthRegistrationPersistence(cradle.prisma)
    ).singleton(),
    oauthAccountRepository: asFunction(
      (cradle: IdentityCradle) =>
        new PrismaOAuthAccountRepository(cradle.prisma)
    ).singleton(),

    eventPublisher: asFunction(
      ({ config }: { config: ContainerConfig }) =>
        config.eventPublisherOverride ?? new RabbitMqEventPublisherAdapter(config.rabbitmqUrl)
    ).singleton(),

    outboxRelay: asFunction(
      (cradle: IdentityCradle) =>
        new OutboxRelayAdapter(cradle.prisma, cradle.eventPublisher)
    ).singleton(),

    tokenService: asFunction(({ config }: { config: ContainerConfig }) => {
      return new JwtTokenService({
        secret: config.jwtSecret,
        expiresInSeconds: config.jwtExpiresInSeconds,
      });
    }).singleton(),

    passwordHasher: asClass(Argon2PasswordHasher).singleton(),

    googleProvider: asFunction(
      ({ config }: { config: ContainerConfig }): IOAuthProvider | null =>
        config.googleOAuth ? new GoogleOAuthProvider(config.googleOAuth) : null
    ).singleton(),

    githubProvider: asFunction(
      ({ config }: { config: ContainerConfig }): IOAuthProvider | null =>
        config.githubOAuth ? new GitHubOAuthProvider(config.githubOAuth) : null
    ).singleton(),

    baseUrl: asFunction(({ config }: { config: ContainerConfig }) => config.baseUrl).singleton(),
    jwtExpiresInSeconds: asFunction(
      ({ config }: { config: ContainerConfig }) => config.jwtExpiresInSeconds
    ).singleton(),

    userCreatedNotifier: asFunction(
      (cradle: IdentityCradle) =>
        new UserCreatedNotifierAdapter(cradle.cache)
    ).singleton(),

    createUserUseCase: asFunction(
      (cradle: IdentityCradle) =>
        new CreateUserUseCase(cradle.userRepository, cradle.userCreatedNotifier)
    ).singleton(),

    getUserByIdUseCase: asFunction(
      (cradle: IdentityCradle) =>
        new GetUserByIdUseCase(cradle.userRepository, cradle.cache)
    ).singleton(),

    registerUseCase: asFunction(
      (cradle: IdentityCradle) =>
        new RegisterUseCase(
          cradle.userRepository,
          cradle.registrationPersistence,
          cradle.passwordHasher,
          cradle.tokenService,
          cradle.userCreatedNotifier
        )
    ).singleton(),

    loginUseCase: asFunction(
      (cradle: IdentityCradle) =>
        new LoginUseCase(
          cradle.userRepository,
          cradle.authCredentialRepository,
          cradle.passwordHasher,
          cradle.tokenService
        )
    ).singleton(),

    getCurrentUserUseCase: asFunction(
      (cradle: IdentityCradle) =>
        new GetCurrentUserUseCase(cradle.userRepository)
    ).singleton(),

    oauthCallbackUseCase: asFunction(
      (cradle: IdentityCradle) =>
        new OAuthCallbackUseCase(
          cradle.userRepository,
          cradle.oauthAccountRepository,
          cradle.userOAuthRegistrationPersistence,
          cradle.tokenService,
          cradle.userCreatedNotifier
        )
    ).singleton(),

    userController: asFunction(
      (cradle: IdentityCradle) =>
        new UserController(cradle.createUserUseCase, cradle.getUserByIdUseCase)
    ).singleton(),

    authController: asFunction(
      (cradle: IdentityCradle) =>
        new AuthController(
          cradle.registerUseCase,
          cradle.loginUseCase,
          cradle.getCurrentUserUseCase,
          cradle.oauthCallbackUseCase,
          cradle.googleProvider,
          cradle.githubProvider,
          cradle.baseUrl,
          cradle.cache,
          cradle.jwtExpiresInSeconds
        )
    ).singleton(),

    authMiddleware: asFunction(
      ({ tokenService }: { tokenService: JwtTokenService }) =>
        createAuthMiddleware((token) => tokenService.verify(token))
    ).singleton(),

    userRoutes: asFunction(
      ({
        userController,
        authMiddleware,
      }: {
        userController: UserController;
        authMiddleware: ReturnType<typeof createAuthMiddleware>;
      }) => createUserRoutes(userController, authMiddleware)
    ).singleton(),

    authRoutes: asFunction(
      ({
        authController,
        authMiddleware,
      }: {
        authController: AuthController;
        authMiddleware: ReturnType<typeof createAuthMiddleware>;
      }) => createAuthRoutes(authController, authMiddleware)
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
    get userRoutes() {
      return c.userRoutes;
    },
    get authRoutes() {
      return c.authRoutes;
    },
    mapApplicationErrorToHttp,
    async connectRabbitMQ(): Promise<void> {
      const ep = c.eventPublisher as { connect?: () => Promise<void> };
      if (ep.connect) await ep.connect();
    },
    startOutboxRelay(intervalMs: number = 2_000): void {
      c.outboxRelay.start(intervalMs);
    },
    async disconnect(): Promise<void> {
      c.outboxRelay.stop();
      const ep = c.eventPublisher as { disconnect?: () => Promise<void> };
      if (ep.disconnect) await ep.disconnect();
      await c.prisma.$disconnect();
      c.redis.disconnect();
    },
  };
}
