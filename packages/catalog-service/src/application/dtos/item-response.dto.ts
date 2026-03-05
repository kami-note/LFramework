import { z } from "zod";

export const itemResponseDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceAmount: z.number(),
  priceCurrency: z.string(),
  createdAt: z.string(),
});

export type ItemResponseDto = z.infer<typeof itemResponseDtoSchema>;
