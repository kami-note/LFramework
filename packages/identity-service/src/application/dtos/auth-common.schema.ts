import { z } from "zod";

const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_PASSWORD_LENGTH = 128;

/**
 * Schema de email reutilizado em register e login.
 */
export const emailSchema = z
  .string()
  .min(1, "email is required")
  .transform((s) => s.trim().toLowerCase())
  .refine((s) => s.length > 0, "email is required")
  .refine((s) => emailFormat.test(s), "Invalid email");
