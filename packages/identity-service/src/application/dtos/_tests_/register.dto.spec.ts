import { describe, it, expect } from "vitest";
import { registerSchema } from "../register.dto";

describe("registerSchema (Zod)", () => {
  it("aceita payload válido e normaliza email", () => {
    const result = registerSchema.safeParse({
      email: "  user@example.com  ",
      name: "Maria",
      password: "senha12345",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.name).toBe("Maria");
      expect(result.data.password).toBe("senha12345");
    }
  });

  it("rejeita senha com menos de 8 caracteres", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      name: "Nome",
      password: "curta",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwdError = result.error.issues.find((i) => i.path.includes("password"));
      expect(pwdError?.message).toMatch(/at least 8|8 characters/);
    }
  });

  it("rejeita email inválido", () => {
    const result = registerSchema.safeParse({
      email: "invalido",
      name: "Nome",
      password: "senha12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita name vazio", () => {
    const result = registerSchema.safeParse({
      email: "a@b.com",
      name: "",
      password: "senha12345",
    });
    expect(result.success).toBe(false);
  });
});
