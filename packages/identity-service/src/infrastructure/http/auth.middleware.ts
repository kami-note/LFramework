import { Request, Response, NextFunction } from "express";
import type { ITokenService } from "../../application/ports/token-service.port";
import { sendError } from "./utils/send-error";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userRole?: string;
    }
  }
}

/**
 * Request após auth middleware: userId, userEmail e userRole garantidos.
 * Use em controllers de rotas protegidas por createAuthMiddleware.
 */
export type AuthenticatedRequest = Request & {
  userId: string;
  userEmail?: string;
  userRole: string;
};

/**
 * Middleware: valida Bearer JWT e anexa userId, userEmail e userRole em req.
 */
export function createAuthMiddleware(tokenService: ITokenService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      sendError(res, 401, "Missing or invalid Authorization header");
      return;
    }
    const token = authHeader.slice(7);
    const payload = tokenService.verify(token);
    if (!payload) {
      sendError(res, 401, "Invalid or expired token");
      return;
    }
    req.userId = payload.sub;
    req.userEmail = payload.email;
    req.userRole = payload.role ?? "user";
    next();
  };
}

/**
 * Middleware: exige que o usuário autenticado tenha a role indicada.
 * Deve ser usado após createAuthMiddleware.
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.userRole !== role) {
      sendError(res, 403, "Forbidden");
      return;
    }
    next();
  };
}
