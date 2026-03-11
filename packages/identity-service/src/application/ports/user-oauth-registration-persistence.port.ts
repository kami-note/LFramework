import type { User } from "../../domain/entities/user.entity";
import type { OAuthProvider } from "../../domain/types";

/**
 * Port (driven): atomic persistence of user + OAuth account (transaction).
 * Used in OAuth callback when user is new (avoids user without oauth_account).
 */
export interface IUserOAuthRegistrationPersistence {
  saveUserAndOAuthAccount(
    user: User,
    provider: OAuthProvider,
    providerId: string
  ): Promise<void>;
}
