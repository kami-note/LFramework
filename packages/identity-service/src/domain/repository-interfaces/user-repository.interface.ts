import { User } from "../entities/user.entity";

/**
 * Porta (Repository): abstração de persistência de User.
 * Implementação em infrastructure/persistence.
 */
export interface IUserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}
