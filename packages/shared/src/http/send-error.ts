import type { Response } from "express";
import type { ErrorResponseDto } from "../dtos/error-response.dto";

/**
 * Centraliza o envio de erro HTTP no formato { error: string } (ErrorResponseDto).
 */
export function sendError(res: Response, status: number, message: string): void {
  if (res.headersSent) return;
  const body: ErrorResponseDto = { error: message };
  res.status(status).json(body);
}
