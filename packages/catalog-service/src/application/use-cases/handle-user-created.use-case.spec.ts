import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandleUserCreatedUseCase } from "./handle-user-created.use-case";
import type { ICacheService } from "@lframework/shared";
import type { IReplicatedUserStore } from "../ports/replicated-user-store.port";

describe("HandleUserCreatedUseCase", () => {
  let replicatedUserStore: IReplicatedUserStore;
  let cache: ICacheService;

  beforeEach(() => {
    replicatedUserStore = {
      upsertFromUserCreated: vi.fn().mockResolvedValue(undefined),
    };
    cache = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("deve replicar usuário e chamar cache.delete com chave user:{userId} ao receber payload", async () => {
    const useCase = new HandleUserCreatedUseCase(replicatedUserStore, cache);
    const payload = {
      userId: "user-abc",
      email: "u@example.com",
      name: "Nome",
      occurredAt: "2025-01-01T00:00:00.000Z",
    };

    await useCase.execute(payload);

    expect(replicatedUserStore.upsertFromUserCreated).toHaveBeenCalledWith(payload);
    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect(cache.delete).toHaveBeenCalledWith("user:user-abc");
  });

  it("deve executar sem lançar quando replication e cache.delete resolvem", async () => {
    const useCase = new HandleUserCreatedUseCase(replicatedUserStore, cache);
    const payload = {
      userId: "outro-id",
      email: "a@b.com",
      name: "Outro",
      occurredAt: "2025-02-01T00:00:00.000Z",
    };

    await expect(useCase.execute(payload)).resolves.toBeUndefined();
    expect(replicatedUserStore.upsertFromUserCreated).toHaveBeenCalledWith(payload);
    expect(cache.delete).toHaveBeenCalledWith("user:outro-id");
  });
});
