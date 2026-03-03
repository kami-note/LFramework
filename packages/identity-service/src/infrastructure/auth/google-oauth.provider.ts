import type { IOAuthProvider, OAuthUserInfo } from "../../application/ports/oauth-provider.port";

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
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return null;
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) return null;

    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) return null;
    const user = (await userRes.json()) as { id?: string; email?: string; name?: string };
    if (!user.id || !user.email) return null;

    return {
      providerId: user.id,
      email: user.email,
      name: (user.name ?? user.email).trim() || user.email,
    };
  }
}
