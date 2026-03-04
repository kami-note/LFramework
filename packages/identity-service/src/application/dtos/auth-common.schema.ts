import { z } from "zod";
import { nameSchema as sharedNameSchema, MAX_NAME_LENGTH as sharedMaxNameLength } from "@lframework/shared";

const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Email: RFC 5321 — endereço completo até 254 caracteres. */
const MAX_EMAIL_LENGTH = 254;

/** Tamanho máximo para nome. Re-exportado do shared. */
export const MAX_NAME_LENGTH = sharedMaxNameLength;

/**
 * Schema de email reutilizado em register e login.
 * Rejeita strings com < ou > (evita script tags e markup). Limite 254 caracteres (RFC).
 */
export const emailSchema = z
  .string()
  .min(1, "email is required")
  .transform((s) => s.trim().toLowerCase())
  .refine((s) => s.length > 0, "email is required")
  .refine((s) => s.length <= MAX_EMAIL_LENGTH, "Invalid email")
  .refine((s) => !s.includes("<") && !s.includes(">"), "Invalid email")
  .refine((s) => emailFormat.test(s), "Invalid email");

/** Nome de pessoa: mesmo schema do shared (trim, min 1, max 200, sem emoji/tags). */
export const nameSchema = sharedNameSchema;
