import type { Response } from "express";
import type { ErrorResponseDto } from "@lframework/shared";

/**
 * Centraliza o envio de erro HTTP no formato { error: string } (ErrorResponseDto).
 */
export function sendError(res: Response, status: number, message: string): void {
  const body: ErrorResponseDto = { error: message };
  res.status(status).json(body);
}
