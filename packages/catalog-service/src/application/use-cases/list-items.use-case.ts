import type { IItemRepository } from "../../domain/repository-interfaces/item-repository.interface";
import type { ICacheService } from "@lframework/shared";
import type { ItemResponseDto } from "../dtos/item-response.dto";

const CACHE_KEY = "items:list";
const CACHE_TTL = 60;

export class ListItemsUseCase {
  constructor(
    private readonly itemRepository: IItemRepository,
    private readonly cache: ICacheService
  ) {}

  async execute(): Promise<ItemResponseDto[]> {
    const cached = await this.cache.get<ItemResponseDto[]>(CACHE_KEY);
    if (cached && Array.isArray(cached)) {
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
