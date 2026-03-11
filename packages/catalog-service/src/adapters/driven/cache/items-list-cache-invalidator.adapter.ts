import type { IItemsListCacheInvalidator } from "../../../application/ports/items-list-cache-invalidator.port";
import type { ICacheService } from "@lframework/shared";

const ITEMS_LIST_KEY = "items:list";

/**
 * Adapter: invalida o cache da lista de itens após criação/atualização.
 * Implementa a porta IItemsListCacheInvalidator (DIP).
 */
export class ItemsListCacheInvalidatorAdapter implements IItemsListCacheInvalidator {
  constructor(private readonly cache: ICacheService) {}

  async invalidate(): Promise<void> {
    await this.cache.delete(ITEMS_LIST_KEY);
  }
}
