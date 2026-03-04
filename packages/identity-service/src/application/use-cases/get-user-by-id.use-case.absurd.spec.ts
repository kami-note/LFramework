import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetUserByIdUseCase } from "./get-user-by-id.use-case";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { ICacheService } from "@lframework/shared";

describe("GetUserByIdUseCase — cenários absurdos", () => {
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

  it("não explode ao receber string vazia como id", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    const useCase = new GetUserByIdUseCase(userRepository, cache);
    const result = await useCase.execute("");
    expect(result).toBeNull();
    expect(userRepository.findById).toHaveBeenCalledWith("");
  });

  it("não explode ao receber id com apenas espaços", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    const useCase = new GetUserByIdUseCase(userRepository, cache);
    const result = await useCase.execute("   ");
    expect(result).toBeNull();
    expect(userRepository.findById).toHaveBeenCalledWith("   ");
  });

  it("não explode ao receber id com caracteres especiais", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    const useCase = new GetUserByIdUseCase(userRepository, cache);
    const result = await useCase.execute("../../etc/passwd");
    expect(result).toBeNull();
  });

  it("não explode ao receber id muito longo", async () => {
    const idLongo = "a".repeat(10_000);
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    const useCase = new GetUserByIdUseCase(userRepository, cache);
    const result = await useCase.execute(idLongo);
    expect(result).toBeNull();
    expect(userRepository.findById).toHaveBeenCalledWith(idLongo);
  });
});
