import { z } from "zod";

const OAUTH_PARAM_MAX_LENGTH = 2048;

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1, "Missing or invalid code").max(OAUTH_PARAM_MAX_LENGTH, "code too long"),
  state: z.string().min(1, "Missing state").max(OAUTH_PARAM_MAX_LENGTH, "state too long"),
});

export type OAuthCallbackQueryDto = z.infer<typeof oauthCallbackQuerySchema>;
