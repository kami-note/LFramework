import { describe, it, expect } from "vitest";
import { mapApplicationErrorToHttp } from "../error-to-http.mapper";
import {
  UserAlreadyExistsError,
  InvalidCredentialsError,
  InvalidEmailError,
  PasswordValidationError,
} from "../../../../../application/errors";

describe("mapApplicationErrorToHttp (identity)", () => {
  it("mapeia UserAlreadyExistsError para 409 e mensagem do erro", () => {
    const err = new UserAlreadyExistsError("User with this email already exists");
    const result = mapApplicationErrorToHttp(err);
    expect(result.statusCode).toBe(409);
    expect(result.message).toBe("User with this email already exists");
  });

  it("mapeia InvalidCredentialsError para 401 e mensagem do erro", () => {
    const err = new InvalidCredentialsError("Invalid email or password");
    const result = mapApplicationErrorToHttp(err);
    expect(result.statusCode).toBe(401);
    expect(result.message).toBe("Invalid email or password");
  });

  it("mapeia InvalidEmailError para 400 e mensagem do erro", () => {
    const err = new InvalidEmailError("Invalid email");
    const result = mapApplicationErrorToHttp(err);
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Invalid email");
  });

  it("mapeia PasswordValidationError para 400 e mensagem do erro", () => {
    const err = new PasswordValidationError("Password must be at least 8 characters");
    const result = mapApplicationErrorToHttp(err);
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Password must be at least 8 characters");
  });

  it("retorna 500 e mensagem genérica para erro não mapeado", () => {
    const err = new Error("Database connection failed");
    const result = mapApplicationErrorToHttp(err);
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("Internal server error");
  });
});
