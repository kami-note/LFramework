import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleUserCreatedUseCase } from "./handle-user-created.use-case";
import type { ICacheService } from "../ports/cache.port";

describe("HandleUserCreatedUseCase", () => {
  let cache: ICacheService;

  beforeEach(() => {
    cache = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("deve chamar cache.delete com chave user:{userId} ao receber payload", async () => {
    const useCase = new HandleUserCreatedUseCase(cache);
    const payload = {
      userId: "user-abc",
      email: "u@example.com",
      name: "Nome",
      occurredAt: "2025-01-01T00:00:00.000Z",
    };

    await useCase.execute(payload);

    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect(cache.delete).toHaveBeenCalledWith("user:user-abc");
  });

  it("deve executar sem lançar quando cache.delete resolve", async () => {
    const useCase = new HandleUserCreatedUseCase(cache);
    const payload = {
      userId: "outro-id",
      email: "a@b.com",
      name: "Outro",
      occurredAt: "2025-02-01T00:00:00.000Z",
    };

    await expect(useCase.execute(payload)).resolves.toBeUndefined();
    expect(cache.delete).toHaveBeenCalledWith("user:outro-id");
  });
});
