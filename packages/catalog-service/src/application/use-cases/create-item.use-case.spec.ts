import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateItemUseCase } from "./create-item.use-case";
import { InvalidItemError } from "../errors";
import type { IItemRepository } from "../../ports/item-repository.port";
import type { IItemsListCacheInvalidator } from "../ports/items-list-cache-invalidator.port";

describe("CreateItemUseCase", () => {
  let itemRepository: IItemRepository;
  let itemsListCacheInvalidator: IItemsListCacheInvalidator;

  beforeEach(() => {
    itemRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
    itemsListCacheInvalidator = {
      invalidate: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("deve criar item com sucesso e retornar ItemResponseDto", async () => {
    const useCase = new CreateItemUseCase(itemRepository, itemsListCacheInvalidator);
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
    expect(itemsListCacheInvalidator.invalidate).toHaveBeenCalled();
  });

  it("deve lançar InvalidItemError quando priceAmount for inválido", async () => {
    const useCase = new CreateItemUseCase(itemRepository, itemsListCacheInvalidator);
    const dto = { name: "Item", priceAmount: -100, priceCurrency: "BRL" };

    await expect(useCase.execute(dto)).rejects.toThrow(InvalidItemError);
    expect(itemRepository.save).not.toHaveBeenCalled();
  });
});
