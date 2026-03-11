import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { createValidateBody } from "./validate-body";
import type { Request, Response, NextFunction } from "express";

describe("createValidateBody", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { body: undefined };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it("deve chamar next() e atribuir body parseado quando válido", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const middleware = createValidateBody(schema);
    req.body = { name: "João", age: 30 };

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request & { body: unknown }).body).toEqual({ name: "João", age: 30 });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("deve enviar 400 e não chamar next() quando validação falha", () => {
    const schema = z.object({ name: z.string().min(1, "Name required") });
    const middleware = createValidateBody(schema);
    req.body = { name: "" };

    middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining("Name required") });
  });

  it("deve tratar req.body undefined como {} e falhar validação", () => {
    const schema = z.object({ name: z.string() });
    const middleware = createValidateBody(schema);
    req.body = undefined;

    middleware(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
