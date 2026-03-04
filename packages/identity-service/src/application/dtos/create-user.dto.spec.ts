import { describe, it, expect } from "vitest";
import { createUserSchema } from "./create-user.dto";

describe("createUserSchema (Zod)", () => {
  it("aceita payload válido e normaliza email", () => {
    const result = createUserSchema.safeParse({
      email: "  User@Example.COM  ",
      name: "João Silva",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.name).toBe("João Silva");
    }
  });

  it("rejeita email inválido", () => {
    const result = createUserSchema.safeParse({
      email: "nao-e-email",
      name: "Nome",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.issues.find((i) => i.path.includes("email"));
      expect(emailError).toBeDefined();
    }
  });

  it("rejeita name vazio", () => {
    const result = createUserSchema.safeParse({
      email: "a@b.com",
      name: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path.includes("name"));
      expect(nameError?.message).toMatch(/name is required|min/);
    }
  });
});
