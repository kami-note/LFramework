import { describe, it, expect } from "vitest";
import { loginSchema } from "../login.dto";

describe("loginSchema (Zod)", () => {
  it("aceita payload válido e normaliza email", () => {
    const result = loginSchema.safeParse({
      email: "  User@Example.COM  ",
      password: "qualquersenha",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.password).toBe("qualquersenha");
    }
  });

  it("rejeita password vazio", () => {
    const result = loginSchema.safeParse({
      email: "a@b.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwdError = result.error.issues.find((i) => i.path.includes("password"));
      expect(pwdError?.message).toMatch(/password is required|required/);
    }
  });

  it("rejeita email inválido", () => {
    const result = loginSchema.safeParse({
      email: "nao-e-email",
      password: "senha",
    });
    expect(result.success).toBe(false);
  });
});
