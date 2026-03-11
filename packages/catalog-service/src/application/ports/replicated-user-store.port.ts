import type { UserCreatedPayload } from "@lframework/shared";

/**
 * Port (driven): store for replicated user data (Data Replication).
 * Updated from user.created events; used as a local read model.
 */
export interface IReplicatedUserStore {
  upsertFromUserCreated(payload: UserCreatedPayload): Promise<void>;
}
