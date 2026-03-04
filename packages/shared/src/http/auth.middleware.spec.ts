import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuthMiddleware, requireRole } from "./auth.middleware";
import type { Request, Response, NextFunction } from "express";

describe("createAuthMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it("deve retornar 401 quando Authorization está ausente", () => {
    const verify = vi.fn();
    const middleware = createAuthMiddleware(verify);

    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing or invalid Authorization header",
    });
    expect(verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("deve retornar 401 quando Authorization não é Bearer", () => {
    req.headers = { authorization: "Basic xyz" };
    const verify = vi.fn();
    const middleware = createAuthMiddleware(verify);

    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Missing or invalid Authorization header",
    });
    expect(verify).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("deve retornar 401 quando verify retorna null (token inválido/expirado)", () => {
    req.headers = { authorization: "Bearer invalid-token" };
    const verify = vi.fn().mockReturnValue(null);
    const middleware = createAuthMiddleware(verify);

    middleware(req as Request, res as Response, next);

    expect(verify).toHaveBeenCalledWith("invalid-token");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid or expired token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("deve anexar userId, userEmail e userRole e chamar next quando token válido", () => {
    req.headers = { authorization: "Bearer valid-token" };
    const payload = {
      sub: "user-123",
      email: "u@example.com",
      role: "admin",
    };
    const verify = vi.fn().mockReturnValue(payload);
    const middleware = createAuthMiddleware(verify);

    middleware(req as Request, res as Response, next);

    expect(verify).toHaveBeenCalledWith("valid-token");
    expect(req.userId).toBe("user-123");
    expect(req.userEmail).toBe("u@example.com");
    expect(req.userRole).toBe("admin");
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("deve usar role 'user' quando payload não traz role", () => {
    req.headers = { authorization: "Bearer token" };
    const verify = vi.fn().mockReturnValue({ sub: "id-1" });
    const middleware = createAuthMiddleware(verify);

    middleware(req as Request, res as Response, next);

    expect(req.userId).toBe("id-1");
    expect(req.userRole).toBe("user");
    expect(next).toHaveBeenCalled();
  });

  it("deve retornar 401 quando payload tem sub vazio", () => {
    req.headers = { authorization: "Bearer token" };
    const verify = vi.fn().mockReturnValue({ sub: "" });
    const middleware = createAuthMiddleware(verify);

    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid token: missing subject",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("deve retornar 401 quando payload tem sub não-string", () => {
    req.headers = { authorization: "Bearer token" };
    const verify = vi.fn().mockReturnValue({ sub: 123 });
    const middleware = createAuthMiddleware(verify);

    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid token: missing subject",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("deve retornar 401 quando payload tem sub só espaços", () => {
    req.headers = { authorization: "Bearer token" };
    const verify = vi.fn().mockReturnValue({ sub: "   " });
    const middleware = createAuthMiddleware(verify);

    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid token: missing subject",
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
  });

  it("deve retornar 403 quando userRole não é a role exigida", () => {
    req.userRole = "user";
    const middleware = requireRole("admin");

    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("deve chamar next quando userRole é a role exigida", () => {
    req.userRole = "admin";
    const middleware = requireRole("admin");

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
