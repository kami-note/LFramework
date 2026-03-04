import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendError } from "./send-error";
import type { Response } from "express";

describe("sendError", () => {
  let res: Partial<Response>;

  beforeEach(() => {
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  });

  it("deve chamar res.status com o código e res.json com { error: message }", () => {
    sendError(res as Response, 401, "Unauthorized");

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("deve suportar 500 e mensagem genérica", () => {
    sendError(res as Response, 500, "Internal server error");

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
