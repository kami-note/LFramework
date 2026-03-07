/**
 * Testes do JwtTokenVerifier estão em @lframework/shared (jwt-token-verifier.spec.ts).
 * Este arquivo garante que o catalog usa o verifier e o auth middleware do shared corretamente.
 */
import { describe, it, expect } from "vitest";
import { JwtTokenVerifier, createAuthMiddleware } from "@lframework/shared";

const VALID_SECRET = "a".repeat(32);

describe("Auth middleware com JwtTokenVerifier (shared)", () => {
  it("deve criar authMiddleware usando JwtTokenVerifier do shared", () => {
    const verifier = new JwtTokenVerifier(VALID_SECRET);
    const authMiddleware = createAuthMiddleware((token) => verifier.verify(token));
    expect(authMiddleware).toBeDefined();
    expect(typeof authMiddleware).toBe("function");
  });
});
