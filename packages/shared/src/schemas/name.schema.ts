import { z } from "zod";

/** Rejeita caracteres que não são nome (evita XSS, emoji, símbolos). Letras, números, espaços, hífen, apóstrofo. */
const nameAllowedPattern = /^[\p{L}\p{N}\s\-'.]+$/u;

/** Tamanho máximo razoável para nome (evita DoS e campos gigantes no DB). */
export const MAX_NAME_LENGTH = 200;

/**
 * Nome de pessoa/item: trim primeiro, min(1), max(200). Sem emoji, sem tags.
 * Reutilizado em identity (user name) e catalog (item name).
 */
export const nameSchema = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s.length >= 1, "name is required")
  .refine((s) => s.length <= MAX_NAME_LENGTH, "name is too long")
  .refine((s) => nameAllowedPattern.test(s), "name contains invalid characters (only letters, numbers, spaces, hyphen, apostrophe)");
