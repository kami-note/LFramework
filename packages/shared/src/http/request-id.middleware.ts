import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

const HEADER_NAME = "x-request-id";
/** Limite defensivo para valor do header (não há RFC específica; evita IDs excessivamente longos). */
const MAX_HEADER_LENGTH = 256;

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
  const headerValue = req.headers[HEADER_NAME] ?? req.headers["request-id"];
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  const requestId =
    trimmed.length > 0 && trimmed.length <= MAX_HEADER_LENGTH
      ? trimmed
      : randomUUID();
  req.requestId = requestId;
  res.setHeader(HEADER_NAME, requestId);
  next();
}
