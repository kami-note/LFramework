import { randomUUID } from "crypto";
import { Item } from "../../domain/entities/item.entity";
import { Money } from "../../domain/value-objects/money.vo";
import type { IItemRepository } from "../../domain/repository-interfaces/item-repository.interface";
import type { ICacheService } from "../ports/cache.port";
import type { CreateItemDto } from "../dtos/create-item.dto";

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
    const price = Money.create(dto.priceAmount, dto.priceCurrency ?? "BRL");
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
  }
}
