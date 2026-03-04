import { Request, Response, NextFunction } from "express";
import type { ITokenService } from "../../application/ports/token-service.port";
import type { ErrorResponseDto } from "../../application/dtos/error-response.dto";

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
      const body: ErrorResponseDto = { error: "Missing or invalid Authorization header" };
      res.status(401).json(body);
      return;
    }
    const token = authHeader.slice(7);
    const payload = tokenService.verify(token);
    if (!payload) {
      const body: ErrorResponseDto = { error: "Invalid or expired token" };
      res.status(401).json(body);
      return;
    }
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  };
}
