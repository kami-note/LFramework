import type { OAuthProvider } from "../../domain/types";

/**
 * Porta: provedor OAuth (Google, GitHub, etc.).
 * Troca o authorization code por dados do usuário no provedor.
 */
export interface OAuthUserInfo {
  providerId: string;
  email: string;
  name: string;
}

export interface IOAuthProvider {
  readonly provider: OAuthProvider;
  getUserInfoFromCode(code: string, redirectUri: string): Promise<OAuthUserInfo | null>;
  getAuthorizationUrl(redirectUri: string, state: string): string;
}
