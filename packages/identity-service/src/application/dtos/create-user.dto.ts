import { z } from "zod";
import { emailSchema, nameSchema } from "./auth-common.schema";

/**
 * Schema de validação para criação de usuário (admin).
 * Fonte única de verdade: tipo e runtime validation.
 */
export const createUserSchema = z.object({
  email: emailSchema,
  name: nameSchema,
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
