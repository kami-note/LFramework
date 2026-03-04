import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../logger", () => ({
  logger: {
    child: vi.fn().mockReturnValue({ error: vi.fn() }),
    error: vi.fn(),
  },
}));

import { logger } from "../logger";
import { errorHandlerMiddleware } from "./error-handler.middleware";

describe("errorHandlerMiddleware", () => {
  let req: Partial<Request & { requestId?: string }>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {};
    res = { headersSent: false, status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it("deve responder 500 com mensagem genérica e não vazar stack", () => {
    const err = new Error("Segredo interno");

    errorHandlerMiddleware(err, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { error: string };
    expect(body).toEqual({ error: "Internal server error" });
    expect(body.error).not.toMatch(/Segredo interno/);
    expect(Object.keys(body)).toEqual(["error"]);
    expect(logger.error).toHaveBeenCalled();
  });

  it("não deve chamar res.status/json quando headersSent for true", () => {
    (res as any).headersSent = true;

    errorHandlerMiddleware(new Error("x"), req as Request, res as Response, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
