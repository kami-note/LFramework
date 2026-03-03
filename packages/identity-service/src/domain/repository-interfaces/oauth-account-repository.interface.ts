/**
 * Porta (Repository): vínculo usuário ↔ provedor OAuth.
 */
export type OAuthProvider = "google" | "github";

export interface IOAuthAccountRepository {
  findByProviderAndProviderId(provider: OAuthProvider, providerId: string): Promise<{ userId: string } | null>;
  save(userId: string, provider: OAuthProvider, providerId: string): Promise<void>;
}
