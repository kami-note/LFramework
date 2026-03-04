import { describe, it, expect } from "vitest";
import { createItemSchema } from "./create-item.dto";

describe("createItemSchema — cenários absurdos", () => {
  it("rejeita payload null", () => {
    const result = createItemSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it("rejeita objeto vazio {}", () => {
    const result = createItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejeita priceAmount como string não numérica", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: "banana",
    });
    // z.coerce.number() converte "banana" para NaN
    expect(result.success).toBe(false);
  });

  it("rejeita priceAmount como array", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: [100, 200],
    });
    expect(result.success).toBe(false);
  });

  it("aceita priceAmount zero (limite do non-negative)", () => {
    const result = createItemSchema.safeParse({
      name: "Grátis",
      priceAmount: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceAmount).toBe(0);
    }
  });

  it("coerce string numérica em priceAmount", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: "42",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceAmount).toBe(42);
    }
  });

  it("rejeita priceCurrency como número", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: 100,
      priceCurrency: 123,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita name como número", () => {
    const result = createItemSchema.safeParse({
      name: 999,
      priceAmount: 100,
    });
    expect(result.success).toBe(false);
  });

  it("aceita name com apenas um caractere", () => {
    const result = createItemSchema.safeParse({
      name: "X",
      priceAmount: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("X");
    }
  });

  it("rejeita priceAmount Infinity", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: Infinity,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = result.error.issues.find((i) => i.path.includes("priceAmount"));
      expect(err?.message).toMatch(/finite|number/);
    }
  });

  it("rejeita priceAmount NaN", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: NaN,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita payload sendo um array", () => {
    const result = createItemSchema.safeParse([ "Item", 100 ]);
    expect(result.success).toBe(false);
  });

  it("rejeita name com emoji", () => {
    const result = createItemSchema.safeParse({
      name: "Produto 🔥",
      priceAmount: 100,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path.includes("name"));
      expect(nameError?.message).toMatch(/invalid characters/);
    }
  });

  it("rejeita name só com espaços (após trim vazio)", () => {
    const result = createItemSchema.safeParse({
      name: "   ",
      priceAmount: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita priceCurrency não suportada", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: 100,
      priceCurrency: "XXX",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = result.error.issues.find((i) => i.path.includes("priceCurrency"));
      expect(err?.message).toMatch(/not supported|currency/);
    }
  });

  it("rejeita priceAmount acima do teto", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: 1_000_000_000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const err = result.error.issues.find((i) => i.path.includes("priceAmount"));
      expect(err?.message).toMatch(/too large/);
    }
  });

  it("aceita priceCurrency USD e EUR", () => {
    expect(createItemSchema.safeParse({ name: "X", priceAmount: 1, priceCurrency: "USD" }).success).toBe(true);
    expect(createItemSchema.safeParse({ name: "Y", priceAmount: 1, priceCurrency: "EUR" }).success).toBe(true);
  });
});
