import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateItemUseCase } from "./create-item.use-case";
import { InvalidItemError } from "../errors";
import type { IItemRepository } from "../../domain/repository-interfaces/item-repository.interface";
import type { ICacheService } from "../ports/cache.port";

describe("CreateItemUseCase", () => {
  let itemRepository: IItemRepository;
  let cache: ICacheService;

  beforeEach(() => {
    itemRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
    cache = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("deve criar item com sucesso e retornar ItemResponseDto", async () => {
    const useCase = new CreateItemUseCase(itemRepository, cache);
    const dto = { name: "Produto X", priceAmount: 9999, priceCurrency: "BRL" };

    const result = await useCase.execute(dto);

    expect(result).toMatchObject({
      name: "Produto X",
      priceAmount: 9999,
      priceCurrency: "BRL",
    });
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(itemRepository.save).toHaveBeenCalled();
    expect(cache.delete).toHaveBeenCalledWith("items:list");
  });

  it("deve lançar InvalidItemError quando priceAmount for inválido", async () => {
    const useCase = new CreateItemUseCase(itemRepository, cache);
    const dto = { name: "Item", priceAmount: -100, priceCurrency: "BRL" };

    await expect(useCase.execute(dto)).rejects.toThrow(InvalidItemError);
    expect(itemRepository.save).not.toHaveBeenCalled();
  });
});
