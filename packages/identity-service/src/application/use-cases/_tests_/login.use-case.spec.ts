import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginUseCase } from "../login.use-case";
import { InvalidCredentialsError } from "../../errors";
import { User } from "../../../domain/entities/user.entity";
import type { IUserRepository } from "../../../domain/repository-interfaces/user-repository.interface";
import type { IAuthCredentialRepository } from "../../../domain/repository-interfaces/auth-credential-repository.interface";
import type { IPasswordHasher } from "../../ports/password-hasher.port";
import type { ITokenService } from "../../ports/token-service.port";

describe("LoginUseCase", () => {
  let userRepository: IUserRepository;
  let authCredentialRepository: IAuthCredentialRepository;
  let passwordHasher: IPasswordHasher;
  let tokenService: ITokenService;

  beforeEach(() => {
    userRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
    };
    authCredentialRepository = {
      getPasswordHashByUserId: vi.fn(),
    };
    passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn().mockResolvedValue(true),
    };
    tokenService = {
      sign: vi.fn().mockReturnValue("fake-jwt-token"),
      verify: vi.fn(),
    };
  });

  it("deve retornar user e accessToken quando credenciais são válidas", async () => {
    const user = User.reconstitute(
      "user-1",
      "u@example.com",
      "Nome",
      new Date("2025-01-01T00:00:00.000Z"),
      "user"
    );
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user);
    vi.mocked(authCredentialRepository.getPasswordHashByUserId).mockResolvedValue("hashed");
    vi.mocked(passwordHasher.verify).mockResolvedValue(true);

    const useCase = new LoginUseCase(
      userRepository,
      authCredentialRepository,
      passwordHasher,
      tokenService
    );
    const result = await useCase.execute({ email: "u@example.com", password: "senha123" });

    expect(result.user).toEqual({
      id: "user-1",
      email: "u@example.com",
      name: "Nome",
    });
    expect(result.accessToken).toBe("fake-jwt-token");
    expect(tokenService.sign).toHaveBeenCalledWith({
      sub: "user-1",
      email: "u@example.com",
      role: "user",
    });
  });

  it("deve lançar InvalidCredentialsError quando usuário não existe", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    const useCase = new LoginUseCase(
      userRepository,
      authCredentialRepository,
      passwordHasher,
      tokenService
    );

    await expect(
      useCase.execute({ email: "naoexiste@example.com", password: "qualquer" })
    ).rejects.toThrow(InvalidCredentialsError);
    await expect(
      useCase.execute({ email: "naoexiste@example.com", password: "qualquer" })
    ).rejects.toThrow("Invalid email or password");
    expect(authCredentialRepository.getPasswordHashByUserId).not.toHaveBeenCalled();
  });

  it("deve lançar InvalidCredentialsError quando hash não existe para o usuário", async () => {
    const user = User.reconstitute("user-1", "u@example.com", "Nome", new Date(), "user");
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user);
    vi.mocked(authCredentialRepository.getPasswordHashByUserId).mockResolvedValue(null);

    const useCase = new LoginUseCase(
      userRepository,
      authCredentialRepository,
      passwordHasher,
      tokenService
    );

    await expect(
      useCase.execute({ email: "u@example.com", password: "senha" })
    ).rejects.toThrow(InvalidCredentialsError);
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it("deve lançar InvalidCredentialsError quando senha está incorreta", async () => {
    const user = User.reconstitute("user-1", "u@example.com", "Nome", new Date(), "user");
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user);
    vi.mocked(authCredentialRepository.getPasswordHashByUserId).mockResolvedValue("hashed");
    vi.mocked(passwordHasher.verify).mockResolvedValue(false);

    const useCase = new LoginUseCase(
      userRepository,
      authCredentialRepository,
      passwordHasher,
      tokenService
    );

    await expect(
      useCase.execute({ email: "u@example.com", password: "senhaerrada" })
    ).rejects.toThrow(InvalidCredentialsError);
    expect(tokenService.sign).not.toHaveBeenCalled();
  });
});
