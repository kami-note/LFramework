import type { IOAuthProvider, OAuthUserInfo } from "../../application/ports/oauth-provider.port";

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
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
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
    });
    if (!tokenRes.ok) return null;
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) return null;

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!userRes.ok) return null;
    const user = (await userRes.json()) as { id?: number; email?: string; name?: string; login?: string };
    if (user.id == null) return null;

    let email = user.email;
    if (!email) {
      const emRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      if (emRes.ok) {
        const emails = (await emRes.json()) as Array<{ email: string; primary?: boolean }>;
        const primary = emails.find((e) => e.primary) ?? emails[0];
        email = primary?.email ?? null;
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
