import type { IItemRepository } from "../ports/item-repository.port";
import type { ICacheService } from "@lframework/shared";
import { itemResponseDtoSchema, type ItemResponseDto } from "../dtos/item-response.dto";
import { z } from "zod";

const CACHE_KEY = "items:list";
const CACHE_TTL = 60;
const itemsListCacheSchema = z.array(itemResponseDtoSchema);

export class ListItemsUseCase {
  constructor(
    private readonly itemRepository: IItemRepository,
    private readonly cache: ICacheService
  ) {}

  async execute(): Promise<ItemResponseDto[]> {
    // Schema Zod valida o cache; se inválido, retorna null (cache miss). Não precisa Array.isArray.
    const cached = await this.cache.get(CACHE_KEY, itemsListCacheSchema);
    if (cached) {
      return cached;
    }

    const items = await this.itemRepository.findAll();
    const dtos: ItemResponseDto[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      priceAmount: item.price.amount,
      priceCurrency: item.price.currency,
      createdAt: item.createdAt.toISOString(),
    }));

    await this.cache.set(CACHE_KEY, dtos, CACHE_TTL);
    return dtos;
  }
}
