import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { JwtTokenVerifier } from "../jwt-token-verifier";

const VALID_SECRET = "a".repeat(32);

describe("JwtTokenVerifier", () => {
  describe("constructor", () => {
    it("deve lançar erro quando secret é undefined", () => {
      expect(() => new JwtTokenVerifier(undefined as unknown as string)).toThrow(
        "JWT secret must be a non-empty string for HS256 signing"
      );
    });

    it("deve lançar erro quando secret é string vazia", () => {
      expect(() => new JwtTokenVerifier("")).toThrow(
        "JWT secret must be a non-empty string for HS256 signing"
      );
    });

    it("deve lançar erro quando secret tem menos de 32 caracteres", () => {
      expect(() => new JwtTokenVerifier("short")).toThrow(
        "JWT secret must be at least 32 characters for HS256 (got 5)"
      );
    });

    it("deve aceitar secret com exatamente 32 caracteres", () => {
      expect(() => new JwtTokenVerifier(VALID_SECRET)).not.toThrow();
    });

    it("deve aceitar secret com mais de 32 caracteres", () => {
      expect(() => new JwtTokenVerifier("a".repeat(64))).not.toThrow();
    });
  });

  describe("verify", () => {
    it("deve retornar payload válido quando token é assinado com o mesmo secret", () => {
      const verifier = new JwtTokenVerifier(VALID_SECRET);
      const token = jwt.sign(
        { sub: "user-1", email: "user@example.com", role: "admin" },
        VALID_SECRET,
        { algorithm: "HS256" }
      );
      const result = verifier.verify(token);
      expect(result).toEqual({
        sub: "user-1",
        email: "user@example.com",
        role: "admin",
      });
    });

    it("deve retornar null quando token é inválido ou assinado com secret diferente", () => {
      const verifier = new JwtTokenVerifier(VALID_SECRET);
      const token = jwt.sign(
        { sub: "user-1" },
        "other-secret-with-32-chars-min!!!",
        { algorithm: "HS256" }
      );
      expect(verifier.verify(token)).toBeNull();
    });
  });
});
