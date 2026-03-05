import type { IOAuthProvider, OAuthUserInfo } from "../../application/ports/oauth-provider.port";
import { logger } from "@lframework/shared";
import { z } from "zod";
import { fetchWithTimeoutAndRetry } from "./fetch-with-timeout";

/** Resposta do POST /login/oauth/access_token (GitHub). */
const githubTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

/** Resposta do GET /user (GitHub API). */
const githubUserResponseSchema = z.object({
  id: z.number(),
  login: z.string(),
  email: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
});

/** Item do GET /user/emails (GitHub API). */
const githubEmailItemSchema = z.object({
  email: z.string().min(1),
  primary: z.boolean().optional(),
});

/** Resposta do GET /user/emails (GitHub API). */
const githubEmailsResponseSchema = z.array(githubEmailItemSchema);

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Adapter: OAuth 2.0 com GitHub.
 * Fluxo authorization code: troca code por access_token e busca /user.
 */
export class GitHubOAuthProvider implements IOAuthProvider {
  readonly provider = "github" as const;

  constructor(private readonly config: GitHubOAuthConfig) {}

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: "user:email",
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async getUserInfoFromCode(code: string, redirectUri: string): Promise<OAuthUserInfo | null> {
    const tokenRes = await fetchWithTimeoutAndRetry(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: redirectUri,
        }),
      },
      10_000
    );
    if (!tokenRes.ok) return null;
    let accessToken: string;
    try {
      const body = await tokenRes.json();
      const tokenParse = githubTokenResponseSchema.safeParse(body);
      if (!tokenParse.success) {
        logger.warn({ err: tokenParse.error.flatten() }, "GitHub token response validation failed");
        return null;
      }
      accessToken = tokenParse.data.access_token;
    } catch (err) {
      logger.warn({ err }, "GitHub token response not JSON");
      return null;
    }

    const userRes = await fetchWithTimeoutAndRetry(
      "https://api.github.com/user",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
      10_000
    );
    if (!userRes.ok) return null;
    let user: z.infer<typeof githubUserResponseSchema>;
    try {
      const body = await userRes.json();
      const userParse = githubUserResponseSchema.safeParse(body);
      if (!userParse.success) {
        logger.warn({ err: userParse.error.flatten() }, "GitHub user response validation failed");
        return null;
      }
      user = userParse.data;
    } catch (err) {
      logger.warn({ err }, "GitHub user response not JSON");
      return null;
    }

    let email = user.email ?? undefined;
    if (!email) {
      const emRes = await fetchWithTimeoutAndRetry(
        "https://api.github.com/user/emails",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
        10_000
      );
      if (emRes.ok) {
        try {
          const body = await emRes.json();
          const emailsParse = githubEmailsResponseSchema.safeParse(body);
          if (emailsParse.success) {
            const emails = emailsParse.data;
            const primary = emails.find((e) => e.primary) ?? emails[0];
            email = primary?.email ?? null;
          } else {
            logger.warn({ err: emailsParse.error.flatten() }, "GitHub user/emails response validation failed, email not available");
          }
        } catch (err) {
          logger.warn({ err }, "GitHub emails response not JSON");
        }
      }
    }
    if (!email) email = `${user.id}+github@users.noreply.github.com`;

    const name = (user.name ?? user.login ?? email).trim();

    return {
      providerId: String(user.id),
      email,
      name,
    };
  }
}
