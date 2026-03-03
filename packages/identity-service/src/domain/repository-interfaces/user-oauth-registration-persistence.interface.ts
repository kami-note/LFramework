import { User } from "../entities/user.entity";
import type { OAuthProvider } from "./oauth-account-repository.interface";

/**
 * Porta: persistência atômica de usuário + conta OAuth (transação).
 * Usado no callback OAuth quando o usuário é novo (evita user sem oauth_account).
 */
export interface IUserOAuthRegistrationPersistence {
  saveUserAndOAuthAccount(user: User, provider: OAuthProvider, providerId: string): Promise<void>;
}
