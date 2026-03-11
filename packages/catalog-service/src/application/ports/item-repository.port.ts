import type { Item } from "../../domain/entities/item.entity";

/**
 * Port (driven): persistence abstraction for Item.
 * Implemented by adapters in adapters/driven/persistence.
 */
export interface IItemRepository {
  save(item: Item): Promise<void>;
  findById(id: string): Promise<Item | null>;
  findAll(): Promise<Item[]>;
}
