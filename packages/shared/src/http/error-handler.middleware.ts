import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";
import type { RequestWithRequestId } from "./request-id.middleware";
import type { HttpErrorMapping } from "./error-mapping";
import { sendError } from "./send-error";

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

/**
 * Cria um middleware de erro que usa um mapper opcional para converter erros de aplicação
 * em status + mensagem HTTP. Quando o mapper retorna um mapeamento, envia essa resposta;
 * caso contrário (ou se não houver mapper), loga e responde 500.
 * Uso: app.use(createErrorHandlerMiddleware(mapApplicationErrorToHttp))
 * Assim os controllers podem fazer catch (err) { next(err); } em vez de map + sendError.
 */
export function createErrorHandlerMiddleware(
  mapper?: (err: unknown) => HttpErrorMapping
): (err: unknown, req: Request, res: Response, next: NextFunction) => void {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = (req as RequestWithRequestId).requestId;
    const log = requestId ? logger.child({ requestId }) : logger;
    log.error({ err }, err instanceof Error ? err.message : "Internal server error");

    if (res.headersSent) {
      return;
    }
    if (mapper) {
      const { statusCode, message } = mapper(err);
      sendError(res, statusCode, message);
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  };
}
