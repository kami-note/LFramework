/**
 * Porta: serviço de cache (ex.: Redis).
 * Implementações em cada serviço ou via RedisCacheAdapter deste pacote.
 */
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
