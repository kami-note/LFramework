import Redis from "ioredis";
import type { z } from "zod";
import type { ICacheService } from "./cache.port";
import { logger } from "../logger";

/**
 * Adapter: implementação do cache com Redis.
 *
 * get(key, schema?): se schema for passado, valida com Zod após JSON.parse;
 * falha de parse ou validação = null + log (cache miss).
 *
 * **Importante:** Sem schema, o retorno NÃO é validado em runtime — dados corrompidos
 * ou maliciosos podem passar. Novos usos devem passar um schema Zod para garantir
 * type-safety em runtime. O retorno `parsed as T` sem schema é legado para compatibilidade.
 */
export class RedisCacheAdapter implements ICacheService {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string, schema?: z.ZodType<T>): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      logger.warn({ err, key }, "Redis cache parse failed, returning null");
      return null;
    }
    if (schema) {
      const result = schema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      logger.warn(
        { key, zodError: result.error.flatten() },
        "Redis cache validation failed, returning null"
      );
      return null;
    }
    return parsed as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
