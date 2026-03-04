import { z } from "zod";

const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Rejeita caracteres que não são nome (evita XSS, emoji, símbolos). Letras, números, espaços, hífen, apóstrofo. */
const nameAllowedPattern = /^[\p{L}\p{N}\s\-'.]+$/u;

/** Tamanho máximo razoável para nome (evita DoS e campos gigantes no DB). */
export const MAX_NAME_LENGTH = 200;

/** Email: RFC 5321 — endereço completo até 254 caracteres. */
const MAX_EMAIL_LENGTH = 254;

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

/**
 * Nome de pessoa: trim primeiro, min(1), max(200). Sem emoji, sem tags.
 */
export const nameSchema = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s.length >= 1, "name is required")
  .refine((s) => s.length <= MAX_NAME_LENGTH, "name is too long")
  .refine((s) => nameAllowedPattern.test(s), "name contains invalid characters (only letters, numbers, spaces, hyphen, apostrophe)");
