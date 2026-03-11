import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";
import type { RequestWithRequestId } from "./request-id.middleware";
import type { HttpErrorMapping } from "./error-mapping";
import { sendError } from "./send-error";

/**
 * Cria um middleware de erro global (4 argumentos). Deve ser registrado depois das rotas.
 * Aceita um mapper opcional para converter erros de aplicação em status + mensagem HTTP.
 * Quando o mapper existe e retorna um mapeamento, envia essa resposta (com log warn/error conforme status).
 * Quando o mapper não existe (ou retorna undefined), loga o erro e responde 500 sem vazar stack ao cliente.
 *
 * @param mapper - Função opcional que mapeia erros para { statusCode, message }
 * @returns Middleware (err, req, res, next)
 *
 * @example Com mapper: app.use(createErrorHandlerMiddleware(mapApplicationErrorToHttp))
 * @example Sem mapper (500 genérico): app.use(createErrorHandlerMiddleware()) ou app.use(errorHandlerMiddleware)
 */
export function createErrorHandlerMiddleware(
  mapper?: (err: unknown) => HttpErrorMapping
): (err: unknown, req: Request, res: Response, next: NextFunction) => void {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const requestId = (req as RequestWithRequestId).requestId;
    const log = requestId ? logger.child({ requestId }) : logger;

    if (res.headersSent) {
      return;
    }
    if (mapper) {
      let statusCode: number;
      let message: string;
      try {
        const mapping = mapper(err);
        if (mapping == null) {
          statusCode = 500;
          message = "Internal server error";
        } else {
          statusCode = mapping.statusCode;
          message = mapping.message;
          if (
            statusCode >= 500 &&
            process.env.NODE_ENV === "test" &&
            err instanceof Error
          ) {
            message = err.message;
          }
        }
      } catch (mapperErr) {
        log.error({ err, mapperError: mapperErr }, "Error handler mapper threw");
        sendError(res, 500, "Internal server error");
        return;
      }
      if (statusCode < 500) {
        log.warn({ err }, err instanceof Error ? err.message : message);
      } else {
        log.error({ err }, err instanceof Error ? err.message : "Internal server error");
      }
      sendError(res, statusCode, message);
      return;
    }
    log.error({ err }, err instanceof Error ? err.message : "Internal server error");
    sendError(res, 500, "Internal server error");
  };
}

/** Alias para createErrorHandlerMiddleware() — middleware de erro sem mapper (500 genérico). */
export const errorHandlerMiddleware = createErrorHandlerMiddleware();
