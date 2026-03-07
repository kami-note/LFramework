import type { IOAuthProvider, OAuthUserInfo } from "../../../../application/ports/oauth-provider.port";
import { logger } from "@lframework/shared";
import { z } from "zod";
import { fetchWithTimeoutAndRetry } from "./fetch-with-timeout";

/** Resposta do POST token (Google OAuth 2.0). */
const googleTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
});

/** Resposta do GET userinfo (Google OAuth 2.0). */
const googleUserResponseSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().optional(),
  picture: z.string().optional(),
});

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Adapter: OAuth 2.0 com Google.
 * Fluxo authorization code: troca code por access_token e busca userinfo.
 */
export class GoogleOAuthProvider implements IOAuthProvider {
  readonly provider = "google" as const;

  constructor(private readonly config: GoogleOAuthConfig) {}

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async getUserInfoFromCode(code: string, redirectUri: string): Promise<OAuthUserInfo | null> {
    const tokenRes = await fetchWithTimeoutAndRetry(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      },
      10_000
    );
    if (!tokenRes.ok) return null;
    let tokenJson: unknown;
    try {
      tokenJson = await tokenRes.json();
    } catch (err) {
      logger.warn({ err }, "Google token response JSON parse failed");
      return null;
    }
    const tokenParse = googleTokenResponseSchema.safeParse(tokenJson);
    if (!tokenParse.success) {
      logger.warn({ err: tokenParse.error.flatten() }, "Google token response validation failed");
      return null;
    }
    const accessToken = tokenParse.data.access_token;

    const userRes = await fetchWithTimeoutAndRetry(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      10_000
    );
    if (!userRes.ok) return null;
    let userParse: ReturnType<typeof googleUserResponseSchema.safeParse>;
    try {
      userParse = googleUserResponseSchema.safeParse(await userRes.json());
    } catch (err) {
      logger.warn({ err }, "Google user response JSON parse failed");
      return null;
    }
    if (!userParse.success) {
      logger.warn({ err: userParse.error.flatten() }, "Google user response validation failed");
      return null;
    }
    const user = userParse.data;

    return {
      providerId: user.id,
      email: user.email,
      name: (user.name ?? user.email).trim() || user.email,
    };
  }
}
