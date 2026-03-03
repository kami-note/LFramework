/**
 * Porta: serviço de cache (ex.: Redis).
 * Implementação em infrastructure/cache.
 */
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
