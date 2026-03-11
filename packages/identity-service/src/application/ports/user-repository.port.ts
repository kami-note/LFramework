import type { User } from "../../domain/entities/user.entity";

/**
 * Port (driven): persistence abstraction for User.
 * Implemented by adapters in adapters/driven/persistence.
 */
export interface IUserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}
