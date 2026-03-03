import { z } from "zod";
import { emailSchema } from "./auth-common.schema";

/**
 * Schema de validação para criação de usuário (admin).
 * Fonte única de verdade: tipo e runtime validation.
 */
export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(1, "name is required").trim(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
