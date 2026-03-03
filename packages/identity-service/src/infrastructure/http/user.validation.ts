import { Request, Response, NextFunction } from "express";
import { createUserSchema } from "../../application/dtos/create-user.dto";
import { sendValidationError } from "./utils/validation-response";

export function validateCreateUser(req: Request, res: Response, next: NextFunction): void {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    sendValidationError(res, result.error);
    return;
  }
  req.body = result.data;
  next();
}
