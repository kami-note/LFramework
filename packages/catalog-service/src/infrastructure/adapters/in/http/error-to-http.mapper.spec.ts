import { describe, it, expect } from "vitest";
import { mapApplicationErrorToHttp } from "./error-to-http.mapper";
import { InvalidItemError } from "../../../../application/errors";

describe("mapApplicationErrorToHttp (catalog)", () => {
  it("mapeia InvalidItemError para 400 e mensagem do erro", () => {
    const err = new InvalidItemError("Invalid item");
    const result = mapApplicationErrorToHttp(err);
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Invalid item");
  });

  it("mapeia InvalidItemError com mensagem customizada para 400", () => {
    const err = new InvalidItemError("Item name is required");
    const result = mapApplicationErrorToHttp(err);
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Item name is required");
  });

  it("retorna 500 e mensagem genérica para erro não mapeado", () => {
    const err = new Error("Unknown error");
    const result = mapApplicationErrorToHttp(err);
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("Internal server error");
  });
});
