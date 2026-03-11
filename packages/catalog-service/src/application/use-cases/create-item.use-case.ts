import { randomUUID } from "crypto";
import { Item } from "../../domain/entities/item.entity";
import { Money } from "../../domain/value-objects/money.vo";
import type { IItemRepository } from "../ports/item-repository.port";
import type { IItemsListCacheInvalidator } from "../ports/items-list-cache-invalidator.port";
import type { CreateItemDto } from "../dtos/create-item.dto";
import type { ItemResponseDto } from "../dtos/item-response.dto";
import { InvalidItemError } from "../errors";

export class CreateItemUseCase {
  constructor(
    private readonly itemRepository: IItemRepository,
    private readonly itemsListCacheInvalidator: IItemsListCacheInvalidator
  ) {}

  async execute(dto: CreateItemDto): Promise<ItemResponseDto> {
    const id = randomUUID();
    try {
      const price = Money.create(dto.priceAmount, dto.priceCurrency);
      const item = Item.create(id, dto.name, price);
      await this.itemRepository.save(item);

      await this.itemsListCacheInvalidator.invalidate();

      const result: ItemResponseDto = {
        id: item.id,
        name: item.name,
        priceAmount: item.price.amount,
        priceCurrency: item.price.currency,
        createdAt: item.createdAt.toISOString(),
      };
      return result;
    } catch (err) {
      throw new InvalidItemError(err instanceof Error ? err.message : "Invalid item");
    }
  }
}
