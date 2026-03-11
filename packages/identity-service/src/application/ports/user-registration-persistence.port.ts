import type { User } from "../../domain/entities/user.entity";
import type { OutboxEvent } from "./outbox-writer.port";

/**
 * Port (driven): atomic persistence of user + credential (transaction).
 * Optionally appends an outbox event in the same transaction (Outbox Pattern).
 */
export interface IUserRegistrationPersistence {
  saveUserAndCredential(
    user: User,
    passwordHash: string,
    outboxEvent?: OutboxEvent
  ): Promise<void>;
}
