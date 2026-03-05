import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestIdMiddleware } from "./request-id.middleware";
import type { NextFunction, Response } from "express";
import type { RequestWithRequestId } from "./request-id.middleware";
import { createMockRequest, createMockResponse } from "../test";

describe("requestIdMiddleware", () => {
  let req: RequestWithRequestId;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = createMockRequest({ headers: {} }) as RequestWithRequestId;
    res = createMockResponse();
    next = vi.fn();
  });

  it("deve gerar requestId e setar no req e no header quando não há header", () => {
    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe("string");
    expect(req.requestId!.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it("deve usar x-request-id do request quando presente", () => {
    req.headers = { "x-request-id": "id-from-client" };
    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe("id-from-client");
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "id-from-client");
    expect(next).toHaveBeenCalled();
  });

  it("deve usar request-id (minúsculo) quando x-request-id não estiver presente", () => {
    req.headers = { "request-id": "alt-id" };
    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe("alt-id");
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "alt-id");
    expect(next).toHaveBeenCalled();
  });

  it("deve gerar novo ID quando header vier vazio ou só espaços", () => {
    req.headers = { "x-request-id": "   " };
    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).not.toBe("   ");
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it("deve gerar novo ID quando header exceder 256 caracteres", () => {
    req.headers = { "x-request-id": "a".repeat(257) };
    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).not.toBe("a".repeat(257));
    expect(req.requestId!.length).toBeLessThanOrEqual(256);
    expect(next).toHaveBeenCalled();
  });

  it("deve usar primeiro elemento quando header vier como array (Express pode enviar string[])", () => {
    req.headers = { "x-request-id": ["first", "second"] };
    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe("first");
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "first");
    expect(next).toHaveBeenCalled();
  });
});
