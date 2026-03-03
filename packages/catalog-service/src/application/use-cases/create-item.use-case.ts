import { randomUUID } from "crypto";
import { Item } from "../../domain/entities/item.entity";
import { Money } from "../../domain/value-objects/money.vo";
import type { IItemRepository } from "../../domain/repository-interfaces/item-repository.interface";
import type { ICacheService } from "@lframework/shared";
import type { CreateItemDto } from "../dtos/create-item.dto";
import { InvalidItemError } from "../errors";

export interface CreateItemUseCaseResult {
  id: string;
  name: string;
  priceAmount: number;
  priceCurrency: string;
  createdAt: Date;
}

export class CreateItemUseCase {
  constructor(
    private readonly itemRepository: IItemRepository,
    private readonly cache: ICacheService
  ) {}

  async execute(dto: CreateItemDto): Promise<CreateItemUseCaseResult> {
    const id = randomUUID();
    try {
      const price = Money.create(dto.priceAmount, dto.priceCurrency);
      const item = Item.create(id, dto.name, price);
      await this.itemRepository.save(item);

      await this.cache.delete("items:list");

      return {
        id: item.id,
        name: item.name,
        priceAmount: item.price.amount,
        priceCurrency: item.price.currency,
        createdAt: item.createdAt,
      };
    } catch (err) {
      throw new InvalidItemError(err instanceof Error ? err.message : "Invalid item");
    }
  }
}
