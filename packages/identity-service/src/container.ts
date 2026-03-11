import { createContainer as createAwilixContainer, asValue, asClass, asFunction } from "awilix";
import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import { RedisCacheAdapter } from "@lframework/shared";
import { PrismaUserRepository } from "./adapters/driven/persistence/prisma-user.repository";
import { PrismaAuthCredentialRepository } from "./adapters/driven/persistence/prisma-auth-credential.repository";
import { PrismaUserRegistrationPersistence } from "./adapters/driven/persistence/prisma-user-registration.repository";
import { PrismaUserOAuthRegistrationPersistence } from "./adapters/driven/persistence/prisma-user-oauth-registration.repository";
import { PrismaOAuthAccountRepository } from "./adapters/driven/persistence/prisma-oauth-account.repository";
import { RabbitMqEventPublisherAdapter } from "./adapters/driven/messaging/rabbitmq-event-publisher.adapter";
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

export interface ContainerConfig {
  databaseUrl: string;
  redisUrl: string;
  rabbitmqUrl: string;
  jwtSecret: string;
  jwtExpiresInSeconds: number;
  baseUrl: string;
  googleOAuth?: { clientId: string; clientSecret: string };
  githubOAuth?: { clientId: string; clientSecret: string };
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
  eventPublisher: RabbitMqEventPublisherAdapter;
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

    cache: asClass(RedisCacheAdapter).singleton(),
    userRepository: asClass(PrismaUserRepository).singleton(),
    authCredentialRepository: asClass(PrismaAuthCredentialRepository).singleton(),
    registrationPersistence: asClass(PrismaUserRegistrationPersistence).singleton(),
    userOAuthRegistrationPersistence: asClass(PrismaUserOAuthRegistrationPersistence).singleton(),
    oauthAccountRepository: asClass(PrismaOAuthAccountRepository).singleton(),

    eventPublisher: asFunction(
      ({ config }: { config: ContainerConfig }) =>
        new RabbitMqEventPublisherAdapter(config.rabbitmqUrl)
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

    userCreatedNotifier: asClass(UserCreatedNotifierAdapter).singleton(),
    createUserUseCase: asClass(CreateUserUseCase).singleton(),
    getUserByIdUseCase: asClass(GetUserByIdUseCase).singleton(),
    registerUseCase: asClass(RegisterUseCase).singleton(),
    loginUseCase: asClass(LoginUseCase).singleton(),
    getCurrentUserUseCase: asClass(GetCurrentUserUseCase).singleton(),
    oauthCallbackUseCase: asClass(OAuthCallbackUseCase).singleton(),

    userController: asClass(UserController).singleton(),
    authController: asClass(AuthController).singleton(),

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
      await c.eventPublisher.connect();
    },
    async disconnect(): Promise<void> {
      await c.eventPublisher.disconnect();
      await c.prisma.$disconnect();
      c.redis.disconnect();
    },
  };
}
