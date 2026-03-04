import { z } from "zod";

/**
 * Schema de validação para criação de item.
 * Fonte única de verdade: tipo e runtime validation.
 */
/** Nome de item: trim, min(1), max(200), sem emoji/tags. */
const MAX_ITEM_NAME_LENGTH = 200;
const itemNameSchema = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s.length >= 1, "name is required")
  .refine((s) => s.length <= MAX_ITEM_NAME_LENGTH, "name is too long")
  .refine((s) => /^[\p{L}\p{N}\s\-'.]+$/u.test(s), "name contains invalid characters");

/** Teto para priceAmount (Int no DB; evita overflow e valores absurdos). Valor em centavos: até 9 dígitos. */
const MAX_PRICE_AMOUNT = 999_999_999;

/** Moedas aceitas (códigos ISO 4217). */
const ALLOWED_CURRENCIES = ["BRL", "USD", "EUR"] as const;
const priceCurrencySchema = z
  .string()
  .length(3, "priceCurrency must be 3 characters")
  .refine((s) => ALLOWED_CURRENCIES.includes(s as (typeof ALLOWED_CURRENCIES)[number]), "currency not supported")
  .optional()
  .default("BRL");

export const createItemSchema = z.object({
  name: itemNameSchema,
  priceAmount: z.coerce
    .number()
    .finite("priceAmount must be a finite number")
    .nonnegative("priceAmount must be non-negative")
    .refine((n) => n <= MAX_PRICE_AMOUNT, "priceAmount too large"),
  priceCurrency: priceCurrencySchema,
});

export type CreateItemDto = z.infer<typeof createItemSchema>;
