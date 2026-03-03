import { Request, Response, NextFunction } from "express";
import { z } from "zod";

const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const registerSchema = z.object({
  email: z
    .string()
    .min(1, "email is required")
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => s.length > 0, "email is required")
    .refine((s) => emailFormat.test(s), "Invalid email"),
  name: z.string().min(1, "name is required").trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "email is required")
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => s.length > 0, "email is required")
    .refine((s) => emailFormat.test(s), "Invalid email"),
  password: z.string().min(1, "password is required"),
});

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
