import type { OAuthProvider } from "../types";

export type { OAuthProvider };

/**
 * Porta (Repository): vínculo usuário ↔ provedor OAuth.
 */
export interface IOAuthAccountRepository {
  findByProviderAndProviderId(provider: OAuthProvider, providerId: string): Promise<{ userId: string } | null>;
  save(userId: string, provider: OAuthProvider, providerId: string): Promise<void>;
}
