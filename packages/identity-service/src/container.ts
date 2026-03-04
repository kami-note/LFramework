import { PrismaClient } from "../generated/prisma-client";
import Redis from "ioredis";
import { RedisCacheAdapter } from "@lframework/shared";
import { PrismaUserRepository } from "./infrastructure/persistence/prisma-user.repository";
import { PrismaAuthCredentialRepository } from "./infrastructure/persistence/prisma-auth-credential.repository";
import { PrismaUserRegistrationPersistence } from "./infrastructure/persistence/prisma-user-registration.repository";
import { PrismaUserOAuthRegistrationPersistence } from "./infrastructure/persistence/prisma-user-oauth-registration.repository";
import { PrismaOAuthAccountRepository } from "./infrastructure/persistence/prisma-oauth-account.repository";
import { RabbitMqEventPublisherAdapter } from "./infrastructure/messaging/rabbitmq-event-publisher.adapter";
import { UserCreatedNotifierAdapter } from "./infrastructure/notifiers/user-created-notifier.adapter";
import { JwtTokenService } from "./infrastructure/auth/jwt-token.service";
import { Argon2PasswordHasher } from "./infrastructure/auth/argon2-password-hasher";
import { GoogleOAuthProvider } from "./infrastructure/auth/google-oauth.provider";
import { GitHubOAuthProvider } from "./infrastructure/auth/github-oauth.provider";
import { CreateUserUseCase } from "./application/use-cases/create-user.use-case";
import { GetUserByIdUseCase } from "./application/use-cases/get-user-by-id.use-case";
import { RegisterUseCase } from "./application/use-cases/register.use-case";
import { LoginUseCase } from "./application/use-cases/login.use-case";
import { GetCurrentUserUseCase } from "./application/use-cases/get-current-user.use-case";
import { OAuthCallbackUseCase } from "./application/use-cases/oauth-callback.use-case";
import { UserController } from "./infrastructure/http/user.controller";
import { AuthController } from "./infrastructure/http/auth.controller";
import { createAuthMiddleware } from "@lframework/shared";
import { createUserRoutes } from "./infrastructure/http/routes";
import { createAuthRoutes } from "./infrastructure/http/auth.routes";

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

/**
 * Composição de dependências (container simples).
 * Adicione novos use cases e adapters aqui ao estender o projeto.
 */
export function createContainer(config: ContainerConfig) {
  const prisma = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } });
  const redis = new Redis(config.redisUrl);
  const eventPublisher = new RabbitMqEventPublisherAdapter(config.rabbitmqUrl);

  const userRepository = new PrismaUserRepository(prisma);
  const authCredentialRepository = new PrismaAuthCredentialRepository(prisma);
  const registrationPersistence = new PrismaUserRegistrationPersistence(prisma);
  const userOAuthRegistrationPersistence = new PrismaUserOAuthRegistrationPersistence(prisma);
  const oauthAccountRepository = new PrismaOAuthAccountRepository(prisma);
  const cache = new RedisCacheAdapter(redis);

  const tokenService = new JwtTokenService({
    secret: config.jwtSecret,
    expiresInSeconds: config.jwtExpiresInSeconds,
  });
  const passwordHasher = new Argon2PasswordHasher();

  const googleProvider = config.googleOAuth
    ? new GoogleOAuthProvider(config.googleOAuth)
    : null;
  const githubProvider = config.githubOAuth
    ? new GitHubOAuthProvider(config.githubOAuth)
    : null;

  const userCreatedNotifier = new UserCreatedNotifierAdapter(eventPublisher, cache);
  const createUserUseCase = new CreateUserUseCase(userRepository, userCreatedNotifier);
  const getUserByIdUseCase = new GetUserByIdUseCase(userRepository, cache);
  const registerUseCase = new RegisterUseCase(
    userRepository,
    registrationPersistence,
    passwordHasher,
    tokenService,
    userCreatedNotifier
  );
  const loginUseCase = new LoginUseCase(
    userRepository,
    authCredentialRepository,
    passwordHasher,
    tokenService
  );
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository);
  const oauthCallbackUseCase = new OAuthCallbackUseCase(
    userRepository,
    oauthAccountRepository,
    userOAuthRegistrationPersistence,
    tokenService,
    userCreatedNotifier
  );

  const userController = new UserController(createUserUseCase, getUserByIdUseCase);
  const authController = new AuthController(
    registerUseCase,
    loginUseCase,
    getCurrentUserUseCase,
    oauthCallbackUseCase,
    googleProvider,
    githubProvider,
    config.baseUrl,
    cache,
    config.jwtExpiresInSeconds
  );

  const authMiddleware = createAuthMiddleware((token) => tokenService.verify(token));
  const userRoutes = createUserRoutes(userController, authMiddleware);
  const authRoutes = createAuthRoutes(authController, authMiddleware);

  return {
    prisma,
    redis,
    userRoutes,
    authRoutes,
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
