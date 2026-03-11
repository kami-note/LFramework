import type { UserCreatedPayload } from "@lframework/shared";
import { logger } from "@lframework/shared";
import type { ICacheService } from "@lframework/shared";
import type { IReplicatedUserStore } from "../ports/replicated-user-store.port";

/**
 * Use case: processes UserCreated event (published by Identity Service).
 * Replicates user data locally (Data Replication) and invalidates cache.
 */
export class HandleUserCreatedUseCase {
  constructor(
    private readonly replicatedUserStore: IReplicatedUserStore,
    private readonly cache: ICacheService
  ) {}

  async execute(payload: UserCreatedPayload): Promise<void> {
    logger.info({ userId: payload.userId }, "UserCreated received");

    await this.replicatedUserStore.upsertFromUserCreated(payload);

    const key = `user:${payload.userId}`;
    await this.cache.delete(key);
  }
}
