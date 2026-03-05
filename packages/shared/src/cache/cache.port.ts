import type { z } from "zod";

/**
 * Porta: serviço de cache (ex.: Redis).
 * Implementações em cada serviço ou via RedisCacheAdapter deste pacote.
 *
 * Overloads de get:
 * - get(key): retorna valor parseado sem validação (comportamento legado; dados não validados em runtime).
 * - get(key, schema): valida com Zod; formato inválido = cache miss (null) + log. Preferível para novos usos.
 */
export interface ICacheService {
  /** Retorna valor parseado sem validação em runtime. Prefira get(key, schema) para novos usos. */
  get<T>(key: string): Promise<T | null>;
  /** Retorna valor validado com schema; falha = null + log. */
  get<T>(key: string, schema: z.ZodType<T>): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
