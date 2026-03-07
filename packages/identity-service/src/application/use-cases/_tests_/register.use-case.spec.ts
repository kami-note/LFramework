import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterUseCase } from "../register.use-case";
import { UserAlreadyExistsError, InvalidEmailError } from "../../errors";
import { User } from "../../../domain/entities/user.entity";
import type { IUserRepository } from "../../../domain/repository-interfaces/user-repository.interface";
import type { IUserRegistrationPersistence } from "../../../domain/repository-interfaces/user-registration-persistence.interface";
import type { IPasswordHasher } from "../../ports/password-hasher.port";
import type { ITokenService } from "../../ports/token-service.port";
import type { IUserCreatedNotifier } from "../../ports/user-created-notifier.port";

describe("RegisterUseCase", () => {
  let userRepository: IUserRepository;
  let registrationPersistence: IUserRegistrationPersistence;
  let passwordHasher: IPasswordHasher;
  let tokenService: ITokenService;
  let userCreatedNotifier: IUserCreatedNotifier;

  beforeEach(() => {
    userRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(null),
    };
    registrationPersistence = {
      saveUserAndCredential: vi.fn().mockResolvedValue(undefined),
    };
    passwordHasher = {
      hash: vi.fn().mockResolvedValue("hashed-password"),
      verify: vi.fn(),
    };
    tokenService = {
      sign: vi.fn().mockReturnValue("fake-jwt"),
      verify: vi.fn(),
    };
    userCreatedNotifier = {
      notify: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("deve registrar usuário com sucesso e retornar user e accessToken", async () => {
    const useCase = new RegisterUseCase(
      userRepository,
      registrationPersistence,
      passwordHasher,
      tokenService,
      userCreatedNotifier
    );
    const dto = {
      email: "novo@example.com",
      name: "Novo User",
      password: "senha123",
    };

    const result = await useCase.execute(dto);

    expect(result.user).toMatchObject({
      email: "novo@example.com",
      name: "Novo User",
    });
    expect(result.user.id).toBeDefined();
    expect(result.user.createdAt).toBeDefined();
    expect(result.accessToken).toBe("fake-jwt");
    expect(registrationPersistence.saveUserAndCredential).toHaveBeenCalled();
    expect(userCreatedNotifier.notify).toHaveBeenCalled();
  });

  it("deve lançar UserAlreadyExistsError quando o email já existe", async () => {
    const existing = User.reconstitute(
      "existing-id",
      "existente@example.com",
      "Existente",
      new Date(),
      "user"
    );
    vi.mocked(userRepository.findByEmail).mockResolvedValue(existing);

    const useCase = new RegisterUseCase(
      userRepository,
      registrationPersistence,
      passwordHasher,
      tokenService,
      userCreatedNotifier
    );

    await expect(
      useCase.execute({
        email: "existente@example.com",
        name: "Outro",
        password: "senha",
      })
    ).rejects.toThrow(UserAlreadyExistsError);
    await expect(
      useCase.execute({
        email: "existente@example.com",
        name: "Outro",
        password: "senha",
      })
    ).rejects.toThrow("User with this email already exists");
    expect(registrationPersistence.saveUserAndCredential).not.toHaveBeenCalled();
  });

  it("deve lançar InvalidEmailError para email inválido", async () => {
    const useCase = new RegisterUseCase(
      userRepository,
      registrationPersistence,
      passwordHasher,
      tokenService,
      userCreatedNotifier
    );

    await expect(
      useCase.execute({
        email: "email-invalido",
        name: "Nome",
        password: "senha123",
      })
    ).rejects.toThrow(InvalidEmailError);
    await expect(
      useCase.execute({
        email: "email-invalido",
        name: "Nome",
        password: "senha123",
      })
    ).rejects.toThrow("Invalid email");
    expect(registrationPersistence.saveUserAndCredential).not.toHaveBeenCalled();
  });
});
