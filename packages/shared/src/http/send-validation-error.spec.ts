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

  it("deve incluir formErrors (erros de raiz, path vazio) na mensagem", () => {
    const zodError = new z.ZodError([
      { code: "custom", path: [], message: "x" },
    ]);
    sendValidationError(res as Response, zodError);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "x" });
  });

  it("deve concatenar formErrors e fieldErrors na mensagem", () => {
    const schema = z
      .object({ name: z.string().min(1, "Name required") })
      .strict();
    const result = schema.safeParse({ name: "", extra: 1 });
    if (result.success) throw new Error("unexpected");
    sendValidationError(res as Response, result.error);

    expect(res.status).toHaveBeenCalledWith(400);
    const sent = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sent.error).toContain("Name required");
    expect(sent.error).toMatch(/Unrecognized|extra/);
  });

  it("deve usar 'Validation failed' quando formErrors e fieldErrors ficam vazios", () => {
    const zodError = new z.ZodError([]);
    sendValidationError(res as Response, zodError);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Validation failed" });
  });
});
