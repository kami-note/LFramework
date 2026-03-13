import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";
import type { RequestWithRequestId } from "./request-id.middleware";

/**
 * Middleware that logs each HTTP request when the response finishes.
 * Logs: method, path, statusCode, durationMs, and requestId when present.
 * Must be used after requestIdMiddleware so requestId is available.
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const requestId = (req as RequestWithRequestId).requestId;
  const log = requestId ? logger.child({ requestId }) : logger;

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    log.info(
      {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      },
      "request"
    );
  });

  next();
}
