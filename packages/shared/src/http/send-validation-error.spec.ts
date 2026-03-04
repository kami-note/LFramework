import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { sendValidationError } from "./send-validation-error";
import type { Response } from "express";

describe("sendValidationError", () => {
  let res: Partial<Response>;

  beforeEach(() => {
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  });

  it("deve enviar 400 com mensagens de fieldErrors concatenadas", () => {
    const schema = z.object({ name: z.string().min(1, "Name required") });
    const result = schema.safeParse({ name: "" });

    if (result.success) throw new Error("unexpected");
    sendValidationError(res as Response, result.error);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining("Name required"),
    });
  });

  it("deve usar 'Validation failed' quando fieldErrors ficam vazios", () => {
    const zodError = new z.ZodError([
      { code: "custom", path: [], message: "x" },
    ]);
    sendValidationError(res as Response, zodError);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Validation failed" });
  });
});
