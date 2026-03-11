import { PrismaClient } from "../../../../generated/prisma-client";
import { Item } from "../../../domain/entities/item.entity";
import type { IItemRepository } from "../../../application/ports/item-repository.port";

export class PrismaItemRepository implements IItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(item: Item): Promise<void> {
    await this.prisma.itemModel.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        name: item.name,
        priceAmount: item.price.amount,
        priceCurrency: item.price.currency,
        createdAt: item.createdAt,
      },
      update: {
        name: item.name,
        priceAmount: item.price.amount,
        priceCurrency: item.price.currency,
      },
    });
  }

  async findById(id: string): Promise<Item | null> {
    const row = await this.prisma.itemModel.findUnique({
      where: { id },
    });
    if (!row) return null;
    return Item.reconstitute(
      row.id,
      row.name,
      row.priceAmount,
      row.priceCurrency,
      row.createdAt
    );
  }

  async findAll(): Promise<Item[]> {
    const rows = await this.prisma.itemModel.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) =>
      Item.reconstitute(
        row.id,
        row.name,
        row.priceAmount,
        row.priceCurrency,
        row.createdAt
      )
    );
  }
}
