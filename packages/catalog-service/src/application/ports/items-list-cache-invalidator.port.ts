/**
 * Porta: invalidação do cache da lista de itens.
 * CreateItemUseCase depende desta abstração (DIP); a implementação fica em infrastructure.
 */
export interface IItemsListCacheInvalidator {
  invalidate(): Promise<void>;
}
