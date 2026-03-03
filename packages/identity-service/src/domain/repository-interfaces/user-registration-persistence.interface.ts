import { User } from "../entities/user.entity";

/**
 * Porta: persistência atômica de usuário + credencial (transação).
 * Evita estado inconsistente (user sem credential ou vice-versa).
 */
export interface IUserRegistrationPersistence {
  saveUserAndCredential(user: User, passwordHash: string): Promise<void>;
}
