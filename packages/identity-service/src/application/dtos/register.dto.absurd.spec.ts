import { describe, it, expect } from "vitest";
import { registerSchema } from "./register.dto";

describe("registerSchema — cenários absurdos", () => {
  it("rejeita payload null", () => {
    expect(registerSchema.safeParse(null).success).toBe(false);
  });

  it("rejeita password como número", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      name: "Nome",
      password: 12345678,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha com 129 caracteres (acima do máximo)", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      name: "Nome",
      password: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("aceita senha com exatamente 128 caracteres (limite)", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      name: "N",
      password: "a".repeat(128),
    });
    expect(result.success).toBe(true);
  });

  it("rejeita quando falta password", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      name: "Nome",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita quando falta email", () => {
    const result = registerSchema.safeParse({
      name: "Nome",
      password: "senha12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita name com mais de 200 caracteres", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      name: "A".repeat(201),
      password: "senha12345",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path.includes("name"));
      expect(nameError?.message).toMatch(/too long/);
    }
  });
});
