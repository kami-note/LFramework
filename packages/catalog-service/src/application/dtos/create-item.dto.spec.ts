import { describe, it, expect } from "vitest";
import { createItemSchema } from "./create-item.dto";

describe("createItemSchema (Zod)", () => {
  it("aceita payload válido e aplica default em priceCurrency", () => {
    const result = createItemSchema.safeParse({
      name: "Produto",
      priceAmount: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Produto",
        priceAmount: 100,
        priceCurrency: "BRL",
      });
    }
  });

  it("rejeita name vazio e retorna erros esperados", () => {
    const result = createItemSchema.safeParse({
      name: "",
      priceAmount: 50,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path.includes("name"));
      expect(nameError?.message).toMatch(/name is required|min/);
    }
  });

  it("rejeita priceAmount negativo", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: -10,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const amountError = result.error.issues.find((i) => i.path.includes("priceAmount"));
      expect(amountError?.message).toMatch(/non-negative|nonnegative/);
    }
  });

  it("rejeita priceCurrency com tamanho diferente de 3", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: 0,
      priceCurrency: "US",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const currencyError = result.error.issues.find((i) => i.path.includes("priceCurrency"));
      expect(currencyError).toBeDefined();
    }
  });

  it("rejeita priceCurrency não suportada (XXX)", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: 0,
      priceCurrency: "XXX",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const currencyError = result.error.issues.find((i) => i.path.includes("priceCurrency"));
      expect(currencyError?.message).toMatch(/currency|supported/i);
    }
  });

  it("rejeita priceAmount acima do máximo (999_999_999)", () => {
    const result = createItemSchema.safeParse({
      name: "Item",
      priceAmount: 1_000_000_000,
      priceCurrency: "BRL",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const amountError = result.error.issues.find((i) => i.path.includes("priceAmount"));
      expect(amountError?.message).toMatch(/large|max/i);
    }
  });
});
