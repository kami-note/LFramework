import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { RedisCacheAdapter } from "./redis-cache.adapter";

const schema = z.object({ id: z.string(), name: z.string() });

describe("RedisCacheAdapter", () => {
  let redis: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; setex: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    redis = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
    };
  });

  describe("get", () => {
    it("retorna null quando chave não existe", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      const adapter = new RedisCacheAdapter(redis as never);

      const result = await adapter.get("missing");

      expect(result).toBeNull();
    });

    it("retorna valor parseado quando chamado sem schema (comportamento legado)", async () => {
      const value = { id: "1", name: "Foo" };
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(value));
      const adapter = new RedisCacheAdapter(redis as never);

      const result = await adapter.get<{ id: string; name: string }>("key");

      expect(result).toEqual(value);
    });

    it("retorna null e não lança quando JSON é inválido (sem schema)", async () => {
      vi.mocked(redis.get).mockResolvedValue("not json {");
      const adapter = new RedisCacheAdapter(redis as never);

      const result = await adapter.get("key");

      expect(result).toBeNull();
    });

    it("com schema: retorna dado validado quando válido", async () => {
      const value = { id: "1", name: "Foo" };
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(value));
      const adapter = new RedisCacheAdapter(redis as never);

      const result = await adapter.get("key", schema);

      expect(result).toEqual(value);
    });

    it("com schema: retorna null quando validação Zod falha", async () => {
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ id: "1", name: 123 })); // name deve ser string
      const adapter = new RedisCacheAdapter(redis as never);

      const result = await adapter.get("key", schema);

      expect(result).toBeNull();
    });

    it("com schema: retorna null quando estrutura não bate (campo faltando)", async () => {
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify({ id: "1" })); // falta name
      const adapter = new RedisCacheAdapter(redis as never);

      const result = await adapter.get("key", schema);

      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("chama set quando não há ttl", async () => {
      vi.mocked(redis.set).mockResolvedValue("OK");
      const adapter = new RedisCacheAdapter(redis as never);

      await adapter.set("key", { a: 1 });

      expect(redis.set).toHaveBeenCalledWith("key", '{"a":1}');
    });

    it("chama setex quando há ttl", async () => {
      vi.mocked(redis.setex).mockResolvedValue("OK");
      const adapter = new RedisCacheAdapter(redis as never);

      await adapter.set("key", { a: 1 }, 60);

      expect(redis.setex).toHaveBeenCalledWith("key", 60, '{"a":1}');
    });
  });

  describe("delete", () => {
    it("chama del", async () => {
      vi.mocked(redis.del).mockResolvedValue(1);
      const adapter = new RedisCacheAdapter(redis as never);

      await adapter.delete("key");

      expect(redis.del).toHaveBeenCalledWith("key");
    });
  });
});
