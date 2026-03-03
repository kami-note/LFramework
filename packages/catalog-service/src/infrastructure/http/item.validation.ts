import { Request, Response, NextFunction } from "express";
import { createItemSchema } from "../../application/dtos/create-item.dto";
import { sendValidationError } from "./utils/validation-response";

export function validateCreateItem(req: Request, res: Response, next: NextFunction): void {
  const result = createItemSchema.safeParse(req.body);
  if (!result.success) {
    sendValidationError(res, result.error);
    return;
  }
  req.body = result.data;
  next();
}
