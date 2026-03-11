import type { OAuthProvider } from "../../domain/types";

export type { OAuthProvider };

/**
 * Port (driven): link user ↔ OAuth provider.
 */
export interface IOAuthAccountRepository {
  findByProviderAndProviderId(
    provider: OAuthProvider,
    providerId: string
  ): Promise<{ userId: string } | null>;
  save(userId: string, provider: OAuthProvider, providerId: string): Promise<void>;
}
