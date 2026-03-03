import { Request, Response, NextFunction } from "express";
import { registerSchema } from "../../application/dtos/register.dto";
import { loginSchema } from "../../application/dtos/login.dto";

export function validateRegister(req: Request, res: Response, next: NextFunction): void {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    const first = result.error.flatten().fieldErrors;
    const message = Object.values(first).flat().join("; ") || "Validation failed";
    res.status(400).json({ error: message });
    return;
  }
  req.body = result.data;
  next();
}

export function validateLogin(req: Request, res: Response, next: NextFunction): void {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    const first = result.error.flatten().fieldErrors;
    const message = Object.values(first).flat().join("; ") || "Validation failed";
    res.status(400).json({ error: message });
    return;
  }
  req.body = result.data;
  next();
}
