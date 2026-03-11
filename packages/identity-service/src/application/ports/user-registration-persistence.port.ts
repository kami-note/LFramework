import type { User } from "../../domain/entities/user.entity";

/**
 * Port (driven): atomic persistence of user + credential (transaction).
 * Avoids inconsistent state (user without credential or vice versa).
 */
export interface IUserRegistrationPersistence {
  saveUserAndCredential(user: User, passwordHash: string): Promise<void>;
}
