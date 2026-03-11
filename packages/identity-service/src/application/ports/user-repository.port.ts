import type { User } from "../../domain/entities/user.entity";
import type { OutboxEvent } from "./outbox-writer.port";

/**
 * Port (driven): persistence abstraction for User.
 * Implemented by adapters in adapters/driven/persistence.
 */
export interface IUserRepository {
  save(user: User): Promise<void>;
  /** Saves user and appends event to outbox in a single transaction (Outbox Pattern). */
  saveUserAndOutbox(user: User, outboxEvent: OutboxEvent): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}
