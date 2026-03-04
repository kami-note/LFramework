import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";
import { sendValidationError } from "./send-validation-error";

/**
 * Cria um middleware Express que valida req.body com um schema Zod.
 * Deve ser usado após express.json(); se req.body for undefined, trata como {}.
 * Em sucesso: atribui o resultado parseado a req.body e chama next().
 * Em falha: chama sendValidationError(res, result.error) e não chama next().
 */
export function createValidateBody<T>(schema: z.ZodType<T>): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body ?? {};
    const result = schema.safeParse(body);
    if (!result.success) {
      sendValidationError(res, result.error);
      return;
    }
    (req as Request & { body: T }).body = result.data;
    next();
  };
}
