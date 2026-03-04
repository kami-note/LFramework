import { z } from "zod";

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1, "Missing or invalid code"),
  state: z.string().min(1, "Missing state"),
});

export type OAuthCallbackQueryDto = z.infer<typeof oauthCallbackQuerySchema>;
