import type { Response } from "express";
import type { z } from "zod";
import type { ErrorResponseDto } from "../dtos/error-response.dto";

/**
 * Envia resposta 400 com mensagens de erro do Zod formatadas.
 * Inclui erros de formulário (formErrors, path vazio) e erros de campo (fieldErrors).
 * O flatten() do Zod já colapsa erros aninhados na chave do pai (ex.: user.email → user).
 * Uso: if (!result.success) { sendValidationError(res, result.error); return; }
 */
export function sendValidationError(res: Response, zodError: z.ZodError): void {
  if (res.headersSent) return;
  const { formErrors, fieldErrors } = zodError.flatten();
  const fieldMessages = Object.values(fieldErrors).flat();
  const message =
    [...formErrors, ...fieldMessages].join("; ").trim() || "Validation failed";
  const body: ErrorResponseDto = { error: message };
  res.status(400).json(body);
}
