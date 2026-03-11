import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListItemsUseCase } from "./list-items.use-case";
import { Item } from "../../domain/entities/item.entity";
import type { IItemRepository } from "../../ports/item-repository.port";
import type { ICacheService } from "@lframework/shared";

describe("ListItemsUseCase", () => {
  let itemRepository: IItemRepository;
  let cache: ICacheService;

  beforeEach(() => {
    itemRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn().mockResolvedValue([]),
    };
    cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
    };
  });

  it("deve retornar lista de itens (cache miss)", async () => {
    const items = [
      Item.reconstitute("id-1", "Item A", 100, "BRL", new Date("2025-01-01T00:00:00.000Z")),
      Item.reconstitute("id-2", "Item B", 200, "BRL", new Date("2025-01-02T00:00:00.000Z")),
    ];
    vi.mocked(itemRepository.findAll).mockResolvedValue(items);

    const useCase = new ListItemsUseCase(itemRepository, cache);
    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "id-1",
      name: "Item A",
      priceAmount: 100,
      priceCurrency: "BRL",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(result[1]).toEqual({
      id: "id-2",
      name: "Item B",
      priceAmount: 200,
      priceCurrency: "BRL",
      createdAt: "2025-01-02T00:00:00.000Z",
    });
    expect(cache.get).toHaveBeenCalledWith("items:list", expect.anything());
    expect(cache.set).toHaveBeenCalledWith("items:list", result, 60);
  });

  it("deve retornar do cache quando existir", async () => {
    const cached = [
      { id: "c-1", name: "Cached", priceAmount: 50, priceCurrency: "BRL", createdAt: "2025-01-01T00:00:00.000Z" },
    ];
    vi.mocked(cache.get).mockResolvedValue(cached);

    const useCase = new ListItemsUseCase(itemRepository, cache);
    const result = await useCase.execute();

    expect(result).toEqual(cached);
    expect(itemRepository.findAll).not.toHaveBeenCalled();
  });

  it("deve propagar erro quando repository.findAll lança", async () => {
    vi.mocked(itemRepository.findAll).mockRejectedValue(new Error("DB error"));
    const useCase = new ListItemsUseCase(itemRepository, cache);

    await expect(useCase.execute()).rejects.toThrow("DB error");
  });
});
