import { Item } from "../entities/item.entity";

/**
 * Porta (Repository): abstração de persistência de Item.
 */
export interface IItemRepository {
  save(item: Item): Promise<void>;
  findById(id: string): Promise<Item | null>;
  findAll(): Promise<Item[]>;
}
