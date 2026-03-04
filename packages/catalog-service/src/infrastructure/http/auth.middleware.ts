import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sendError } from "@lframework/shared";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Request após auth middleware no catalog: userId garantido.
 * Use em controllers de rotas protegidas por createCatalogAuthMiddleware.
 */
export type AuthenticatedRequest = Request & { userId: string };

/**
 * Middleware: valida Bearer JWT (mesmo contrato/secret do identity-service) e anexa userId em req.
 * Usado para proteger rotas que exigem autenticação (ex.: POST /api/items).
 */
export function createCatalogAuthMiddleware(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      sendError(res, 401, "Missing or invalid Authorization header");
      return;
    }
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as { sub?: string };
      if (decoded.sub) {
        req.userId = decoded.sub;
      }
      next();
    } catch {
      sendError(res, 401, "Invalid or expired token");
    }
  };
}
