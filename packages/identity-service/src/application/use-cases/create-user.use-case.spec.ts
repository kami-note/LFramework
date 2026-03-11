import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateUserUseCase } from "./create-user.use-case";
import { UserAlreadyExistsError, InvalidEmailError } from "../errors";
import { User } from "../../domain/entities/user.entity";
import type { IUserRepository } from "../ports/user-repository.port";
import type { IUserCreatedNotifier } from "../ports/user-created-notifier.port";

describe("CreateUserUseCase", () => {
  let userRepository: IUserRepository;
  let userCreatedNotifier: IUserCreatedNotifier;

  beforeEach(() => {
    userRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByEmail: vi.fn().mockResolvedValue(null),
    };
    userCreatedNotifier = {
      notify: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("deve criar usuário com sucesso e retornar UserResponseDto", async () => {
    const useCase = new CreateUserUseCase(userRepository, userCreatedNotifier);
    const dto = { email: "user@example.com", name: "João Silva" };

    const result = await useCase.execute(dto);

    expect(result).toMatchObject({
      email: "user@example.com",
      name: "João Silva",
    });
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(userRepository.findByEmail).toHaveBeenCalledWith("user@example.com");
    expect(userRepository.save).toHaveBeenCalled();
    expect(userCreatedNotifier.notify).toHaveBeenCalled();
  });

  it("deve lançar UserAlreadyExistsError quando o email já existe", async () => {
    const existingUser = User.reconstitute(
      "existing-id",
      "existing@example.com",
      "Existing",
      new Date(),
      "user"
    );
    vi.mocked(userRepository.findByEmail).mockResolvedValue(existingUser);

    const useCase = new CreateUserUseCase(userRepository, userCreatedNotifier);
    const dto = { email: "existing@example.com", name: "Outro" };

    await expect(useCase.execute(dto)).rejects.toThrow(UserAlreadyExistsError);
    await expect(useCase.execute(dto)).rejects.toThrow("User with this email already exists");
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it("deve lançar InvalidEmailError para email inválido", async () => {
    const useCase = new CreateUserUseCase(userRepository, userCreatedNotifier);
    const dto = { email: "invalid-email", name: "João" };

    await expect(useCase.execute(dto)).rejects.toThrow(InvalidEmailError);
    await expect(useCase.execute(dto)).rejects.toThrow("Invalid email");
    expect(userRepository.save).not.toHaveBeenCalled();
  });
});
