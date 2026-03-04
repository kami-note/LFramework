import { z } from "zod";
import { emailSchema, nameSchema, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "./auth-common.schema";

/**
 * Schema de validação para registro de usuário.
 * Fonte única de verdade: tipo e runtime validation.
 */
export const registerSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters")
    .max(MAX_PASSWORD_LENGTH, "Password must be at most 128 characters"),
});

export type RegisterDto = z.infer<typeof registerSchema>;
