import { describe, it, expect } from "vitest";
import { createErrorToHttpMapper } from "../error-to-http.factory";

class CustomError extends Error {
  override name = "CustomError";
  constructor(message = "Custom") {
    super(message);
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

describe("createErrorToHttpMapper", () => {
  it("deve retornar status e message para erro conhecido", () => {
    const mapper = createErrorToHttpMapper([[CustomError, 422]]);
    const err = new CustomError("Mensagem custom");

    const result = mapper(err);

    expect(result).toEqual({ statusCode: 422, message: "Mensagem custom" });
  });

  it("deve retornar 500 e mensagem padrão para erro desconhecido", () => {
    const mapper = createErrorToHttpMapper([[CustomError, 422]]);
    const err = new Error("Outro erro");

    const result = mapper(err);

    expect(result).toEqual({ statusCode: 500, message: "Internal server error" });
  });

  it("deve usar defaultMapping customizado quando fornecido", () => {
    const mapper = createErrorToHttpMapper(
      [[CustomError, 400]],
      { statusCode: 503, message: "Service unavailable" }
    );
    const err = new Error("Desconhecido");

    const result = mapper(err);

    expect(result).toEqual({ statusCode: 503, message: "Service unavailable" });
  });

  it("deve mapear o primeiro match quando vários erros são registrados", () => {
    class A extends Error {}
    class B extends Error {}
    const mapper = createErrorToHttpMapper([
      [A, 400],
      [B, 409],
    ]);

    expect(mapper(new A())).toEqual({ statusCode: 400, message: "" });
    expect(mapper(new B())).toEqual({ statusCode: 409, message: "" });
  });
});
