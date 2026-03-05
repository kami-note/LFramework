import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetUserByIdUseCase } from "./get-user-by-id.use-case";
import { User } from "../../domain/entities/user.entity";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { ICacheService } from "@lframework/shared";

describe("GetUserByIdUseCase", () => {
  let userRepository: IUserRepository;
  let cache: ICacheService;

  beforeEach(() => {
    userRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
    };
    cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
    };
  });

  it("deve retornar usuário quando encontrado no repositório (cache miss)", async () => {
    const user = User.reconstitute(
      "user-123",
      "u@example.com",
      "Nome",
      new Date("2025-01-01T00:00:00.000Z"),
      "user"
    );
    vi.mocked(userRepository.findById).mockResolvedValue(user);

    const useCase = new GetUserByIdUseCase(userRepository, cache);
    const result = await useCase.execute("user-123");

    expect(result).toEqual({
      id: "user-123",
      email: "u@example.com",
      name: "Nome",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(cache.get).toHaveBeenCalledWith("user:user-123", expect.anything());
    expect(cache.set).toHaveBeenCalledWith("user:user-123", expect.any(Object), 300);
  });

  it("deve retornar null quando usuário não existe", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    const useCase = new GetUserByIdUseCase(userRepository, cache);
    const result = await useCase.execute("inexistente");

    expect(result).toBeNull();
    expect(cache.get).toHaveBeenCalledWith("user:inexistente", expect.anything());
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("deve retornar do cache quando existir (não chama repositório)", async () => {
    const cached = {
      id: "cached-1",
      email: "c@example.com",
      name: "Cached",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    vi.mocked(cache.get).mockResolvedValue(cached);

    const useCase = new GetUserByIdUseCase(userRepository, cache);
    const result = await useCase.execute("cached-1");

    expect(result).toEqual(cached);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });
});
