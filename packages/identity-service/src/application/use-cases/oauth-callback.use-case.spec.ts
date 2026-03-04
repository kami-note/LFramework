import { describe, it, expect, vi, beforeEach } from "vitest";
import { OAuthCallbackUseCase } from "./oauth-callback.use-case";
import { User } from "../../domain/entities/user.entity";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { IOAuthAccountRepository } from "../../domain/repository-interfaces/oauth-account-repository.interface";
import type { IUserOAuthRegistrationPersistence } from "../../domain/repository-interfaces/user-oauth-registration-persistence.interface";
import type { IOAuthProvider } from "../ports/oauth-provider.port";
import type { ITokenService } from "../ports/token-service.port";
import type { ICacheService } from "../ports/cache.port";
import type { IEventPublisher } from "../ports/event-publisher.port";

describe("OAuthCallbackUseCase", () => {
  let userRepository: IUserRepository;
  let oauthAccountRepository: IOAuthAccountRepository;
  let userOAuthRegistrationPersistence: IUserOAuthRegistrationPersistence;
  let tokenService: ITokenService;
  let cache: ICacheService;
  let eventPublisher: IEventPublisher;
  let provider: IOAuthProvider;

  beforeEach(() => {
    userRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
    };
    oauthAccountRepository = {
      findByProviderAndProviderId: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    };
    userOAuthRegistrationPersistence = {
      saveUserAndOAuthAccount: vi.fn().mockResolvedValue(undefined),
    };
    tokenService = {
      sign: vi.fn().mockReturnValue("jwt-token"),
      verify: vi.fn(),
    };
    cache = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
    };
    eventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    provider = {
      provider: "google",
      getUserInfoFromCode: vi.fn(),
      getAuthorizationUrl: vi.fn(),
    };
  });

  it("deve retornar user e token com isNewUser false quando link OAuth já existe", async () => {
    vi.mocked(provider.getUserInfoFromCode).mockResolvedValue({
      providerId: "google-123",
      email: "existente@example.com",
      name: "Existente",
    });
    vi.mocked(oauthAccountRepository.findByProviderAndProviderId).mockResolvedValue({
      userId: "user-1",
    });
    const user = User.reconstitute(
      "user-1",
      "existente@example.com",
      "Existente",
      new Date("2025-01-01T00:00:00.000Z"),
      "user"
    );
    vi.mocked(userRepository.findById).mockResolvedValue(user);

    const useCase = new OAuthCallbackUseCase(
      userRepository,
      oauthAccountRepository,
      userOAuthRegistrationPersistence,
      tokenService,
      cache,
      eventPublisher
    );
    const result = await useCase.execute("code", "http://localhost/callback", provider);

    expect(result.user.isNewUser).toBe(false);
    expect(result.user.id).toBe("user-1");
    expect(result.user.email).toBe("existente@example.com");
    expect(result.accessToken).toBe("jwt-token");
    expect(tokenService.sign).toHaveBeenCalledWith({
      sub: "user-1",
      email: "existente@example.com",
      role: "user",
    });
    expect(userOAuthRegistrationPersistence.saveUserAndOAuthAccount).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it("deve criar usuário, publicar evento e retornar isNewUser true quando não existe link nem usuário", async () => {
    vi.mocked(provider.getUserInfoFromCode).mockResolvedValue({
      providerId: "google-456",
      email: "novo@example.com",
      name: "Novo User",
    });
    vi.mocked(oauthAccountRepository.findByProviderAndProviderId).mockResolvedValue(null);
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    const useCase = new OAuthCallbackUseCase(
      userRepository,
      oauthAccountRepository,
      userOAuthRegistrationPersistence,
      tokenService,
      cache,
      eventPublisher
    );
    const result = await useCase.execute("code", "http://localhost/callback", provider);

    expect(result.user.isNewUser).toBe(true);
    expect(result.user.email).toBe("novo@example.com");
    expect(result.user.name).toBe("Novo User");
    expect(result.user.id).toBeDefined();
    expect(result.accessToken).toBe("jwt-token");
    expect(userOAuthRegistrationPersistence.saveUserAndOAuthAccount).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalled();
  });

  it("deve lançar quando getUserInfoFromCode retorna null", async () => {
    vi.mocked(provider.getUserInfoFromCode).mockResolvedValue(null);

    const useCase = new OAuthCallbackUseCase(
      userRepository,
      oauthAccountRepository,
      userOAuthRegistrationPersistence,
      tokenService,
      cache,
      eventPublisher
    );

    await expect(
      useCase.execute("invalid-code", "http://localhost/callback", provider)
    ).rejects.toThrow("Failed to get user info from OAuth provider");
  });
});
