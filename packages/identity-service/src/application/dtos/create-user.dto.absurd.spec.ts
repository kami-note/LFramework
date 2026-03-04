import { describe, it, expect } from "vitest";
import { createUserSchema } from "./create-user.dto";

describe("createUserSchema — cenários absurdos", () => {
  it("rejeita payload null", () => {
    const result = createUserSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it("rejeita payload undefined", () => {
    const result = createUserSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it("rejeita objeto vazio {}", () => {
    const result = createUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejeita email como número", () => {
    const result = createUserSchema.safeParse({
      email: 12345,
      name: "Nome",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita name como array", () => {
    const result = createUserSchema.safeParse({
      email: "a@b.com",
      name: ["João", "Silva"],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita name como objeto", () => {
    const result = createUserSchema.safeParse({
      email: "a@b.com",
      name: { first: "João", last: "Silva" },
    });
    expect(result.success).toBe(false);
  });

  it("rejeita payload sendo um array", () => {
    const result = createUserSchema.safeParse(["a@b.com", "Nome"]);
    expect(result.success).toBe(false);
  });

  it("rejeita email com apenas espaços (após trim vira vazio)", () => {
    const result = createUserSchema.safeParse({
      email: "   ",
      name: "Nome",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita name com emojis", () => {
    const result = createUserSchema.safeParse({
      email: "u@example.com",
      name: "João 🚀 Silva 🔥",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path.includes("name"));
      expect(nameError?.message).toMatch(/invalid characters/);
    }
  });

  it("rejeita name só com emoji", () => {
    const result = createUserSchema.safeParse({
      email: "u@example.com",
      name: "🔥🚀",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita string que parece SQL injection no email", () => {
    const result = createUserSchema.safeParse({
      email: "'; DROP TABLE users; --",
      name: "Hacker",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita email com script tag", () => {
    const result = createUserSchema.safeParse({
      email: "<script>alert(1)</script>@x.com",
      name: "X",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.issues.find((i) => i.path.includes("email"));
      expect(emailError).toBeDefined();
    }
  });

  it("rejeita name com apenas espaços/quebras (após trim fica vazio)", () => {
    const result = createUserSchema.safeParse({
      email: "a@b.com",
      name: " \t\n\r ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path.includes("name"));
      expect(nameError?.message).toMatch(/name is required|invalid/);
    }
  });

  it("rejeita name com caracteres especiais (ex.: < ou >)", () => {
    const result = createUserSchema.safeParse({
      email: "a@b.com",
      name: "<script>",
    });
    expect(result.success).toBe(false);
  });

  it("aceita name com acentos e hífen/apóstrofo", () => {
    const result = createUserSchema.safeParse({
      email: "a@b.com",
      name: "João Silva",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("João Silva");
    }
  });
});
