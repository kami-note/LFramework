import { describe, it, expect, beforeEach } from "vitest";
import { sendError } from "../send-error";
import type { Response } from "express";
import { createMockResponse } from "../../test";

describe("sendError", () => {
  let res: Response;

  beforeEach(() => {
    res = createMockResponse();
  });

  it("deve chamar res.status com o código e res.json com { error: message }", () => {
    sendError(res, 401, "Unauthorized");

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("deve suportar 500 e mensagem genérica", () => {
    sendError(res, 500, "Internal server error");

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
