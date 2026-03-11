/**
 * Porta: invalidação do cache da lista de itens.
 * CreateItemUseCase depends on this abstraction (DIP); the implementation lives in adapters/driven.
 */
export interface IItemsListCacheInvalidator {
  invalidate(): Promise<void>;
}
