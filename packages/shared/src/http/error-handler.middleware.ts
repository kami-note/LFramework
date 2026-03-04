import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";
import type { RequestWithRequestId } from "./request-id.middleware";

/**
 * Middleware de erro global (4 argumentos). Deve ser registrado depois das rotas.
 * Loga o erro (com requestId quando disponível) e responde 500 sem vazar stack ao cliente.
 */
export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as RequestWithRequestId).requestId;
  const log = requestId ? logger.child({ requestId }) : logger;
  log.error({ err }, err instanceof Error ? err.message : "Internal server error");

  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal server error" });
}
