import { Request, Response, NextFunction } from "express";
import { createItemSchema } from "../../application/dtos/create-item.dto";

export function validateCreateItem(req: Request, res: Response, next: NextFunction): void {
  const result = createItemSchema.safeParse(req.body);
  if (!result.success) {
    const first = result.error.flatten().fieldErrors;
    const message = Object.values(first).flat().join("; ") || "Validation failed";
    res.status(400).json({ error: message });
    return;
  }
  req.body = result.data;
  next();
}
