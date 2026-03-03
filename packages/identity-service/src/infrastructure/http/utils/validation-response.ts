import type { Response } from "express";
import type { z } from "zod";

/**
 * Envia resposta 400 com mensagens de erro do Zod formatadas.
 * Uso: if (!result.success) { sendValidationError(res, result.error); return; }
 */
export function sendValidationError(res: Response, zodError: z.ZodError): void {
  const first = zodError.flatten().fieldErrors;
  const message = Object.values(first).flat().join("; ") || "Validation failed";
  res.status(400).json({ error: message });
}
