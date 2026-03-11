import { describe, it, expect, vi, beforeEach } from "vitest";
import { OAuthCallbackUseCase } from "./oauth-callback.use-case";
import { User } from "../../domain/entities/user.entity";
import type { IUserRepository } from "../ports/user-repository.port";
import type { IOAuthAccountRepository } from "../ports/oauth-account-repository.port";
import type { IUserOAuthRegistrationPersistence } from "../ports/user-oauth-registration-persistence.port";
import type { IOAuthProvider } from "../ports/oauth-provider.port";
import type { ITokenService } from "../ports/token-service.port";
import type { IUserCreatedNotifier } from "../ports/user-created-notifier.port";

describe("OAuthCallbackUseCase", () => {
  let userRepository: IUserRepository;
  let oauthAccountRepository: IOAuthAccountRepository;
  let userOAuthRegistrationPersistence: IUserOAuthRegistrationPersistence;
  let tokenService: ITokenService;
  let userCreatedNotifier: IUserCreatedNotifier;
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
    userCreatedNotifier = {
      notify: vi.fn().mockResolvedValue(undefined),
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
      userCreatedNotifier
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
    expect(userCreatedNotifier.notify).not.toHaveBeenCalled();
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
      userCreatedNotifier
    );
    const result = await useCase.execute("code", "http://localhost/callback", provider);

    expect(result.user.isNewUser).toBe(true);
    expect(result.user.email).toBe("novo@example.com");
    expect(result.user.name).toBe("Novo User");
    expect(result.user.id).toBeDefined();
    expect(result.accessToken).toBe("jwt-token");
    expect(userOAuthRegistrationPersistence.saveUserAndOAuthAccount).toHaveBeenCalledTimes(1);
    expect(userCreatedNotifier.notify).toHaveBeenCalledTimes(1);
  });

  it("deve passar outboxEvent para saveUserAndOAuthAccount quando novo usuário (Outbox Pattern)", async () => {
    vi.mocked(provider.getUserInfoFromCode).mockResolvedValue({
      providerId: "github-789",
      email: "oauth-new@example.com",
      name: "OAuth New",
    });
    vi.mocked(oauthAccountRepository.findByProviderAndProviderId).mockResolvedValue(null);
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    const useCase = new OAuthCallbackUseCase(
      userRepository,
      oauthAccountRepository,
      userOAuthRegistrationPersistence,
      tokenService,
      userCreatedNotifier
    );
    await useCase.execute("code", "http://localhost/callback", provider);

    const saveCall = vi.mocked(userOAuthRegistrationPersistence.saveUserAndOAuthAccount).mock.calls[0];
    expect(saveCall).toHaveLength(4);
    const [, , , outboxEvent] = saveCall;
    expect(outboxEvent).toBeDefined();
    expect(outboxEvent!.eventName).toBe("user.created");
    expect(outboxEvent!.payload).toMatchObject({
      userId: expect.any(String),
      email: "oauth-new@example.com",
      name: "OAuth New",
      occurredAt: expect.any(String),
    });
  });

  it("deve lançar quando getUserInfoFromCode retorna null", async () => {
    vi.mocked(provider.getUserInfoFromCode).mockResolvedValue(null);

    const useCase = new OAuthCallbackUseCase(
      userRepository,
      oauthAccountRepository,
      userOAuthRegistrationPersistence,
      tokenService,
      userCreatedNotifier
    );

    await expect(
      useCase.execute("invalid-code", "http://localhost/callback", provider)
    ).rejects.toThrow("Failed to get user info from OAuth provider");
  });
});
