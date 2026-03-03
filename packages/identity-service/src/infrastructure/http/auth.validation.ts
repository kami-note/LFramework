import { Request, Response, NextFunction } from "express";
import { registerSchema } from "../../application/dtos/register.dto";
import { loginSchema } from "../../application/dtos/login.dto";
import { sendValidationError } from "./utils/validation-response";

export function validateRegister(req: Request, res: Response, next: NextFunction): void {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    sendValidationError(res, result.error);
    return;
  }
  req.body = result.data;
  next();
}

export function validateLogin(req: Request, res: Response, next: NextFunction): void {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    sendValidationError(res, result.error);
    return;
  }
  req.body = result.data;
  next();
}
