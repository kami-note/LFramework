import { Request, Response, NextFunction } from "express";
import type { ITokenService } from "../../application/ports/token-service.port";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/**
 * Middleware: valida Bearer JWT e anexa userId/userEmail em req.
 */
export function createAuthMiddleware(tokenService: ITokenService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    const token = authHeader.slice(7);
    const payload = tokenService.verify(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  };
}
