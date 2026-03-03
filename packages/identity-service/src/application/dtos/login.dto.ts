import { z } from "zod";
import { emailSchema, MAX_PASSWORD_LENGTH } from "./auth-common.schema";

/**
 * Schema de validação para login.
 * Fonte única de verdade: tipo e runtime validation.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "password is required")
    .max(MAX_PASSWORD_LENGTH, "Password must be at most 128 characters"),
});

export type LoginDto = z.infer<typeof loginSchema>;
