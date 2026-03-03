import { z } from "zod";

/**
 * Schema de validação para criação de item.
 * Fonte única de verdade: tipo e runtime validation.
 */
export const createItemSchema = z.object({
  name: z.string().min(1, "name is required").trim(),
  priceAmount: z.coerce.number().nonnegative("priceAmount must be non-negative"),
  priceCurrency: z.string().length(3, "priceCurrency must be 3 characters").optional().default("BRL"),
});

export type CreateItemDto = z.infer<typeof createItemSchema>;
