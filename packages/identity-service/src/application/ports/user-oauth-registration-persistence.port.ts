import type { User } from "../../domain/entities/user.entity";
import type { OAuthProvider } from "../../domain/types";
import type { OutboxEvent } from "./outbox-writer.port";

/**
 * Port (driven): atomic persistence of user + OAuth account (transaction).
 * Optionally appends an outbox event in the same transaction (Outbox Pattern).
 */
export interface IUserOAuthRegistrationPersistence {
  saveUserAndOAuthAccount(
    user: User,
    provider: OAuthProvider,
    providerId: string,
    outboxEvent?: OutboxEvent
  ): Promise<void>;
}
