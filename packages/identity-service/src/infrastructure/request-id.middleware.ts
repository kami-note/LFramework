import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

const HEADER_NAME = "x-request-id";

export interface RequestWithRequestId extends Request {
  requestId?: string;
}

/**
 * Gera ou lê o header X-Request-Id (ou request-id), anexa ao req e envia na resposta.
 */
export function requestIdMiddleware(
  req: RequestWithRequestId,
  res: Response,
  next: NextFunction
): void {
  const incoming =
    (req.headers[HEADER_NAME] as string) ??
    (req.headers["request-id"] as string);
  const requestId = (typeof incoming === "string" && incoming.trim()) || randomUUID();
  req.requestId = requestId;
  res.setHeader(HEADER_NAME, requestId);
  next();
}
