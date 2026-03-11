import type { IUserCreatedNotifier, UserCreatedNotifyInput } from "../../../application/ports/user-created-notifier.port";
import type { ICacheService } from "@lframework/shared";

/**
 * Adapter: updates local cache after user creation.
 * Event publishing is done via Outbox Pattern (outbox relay publishes to RabbitMQ).
 */
export class UserCreatedNotifierAdapter implements IUserCreatedNotifier {
  constructor(private readonly cache: ICacheService) {}

  async notify(user: UserCreatedNotifyInput): Promise<void> {
    const cacheKey = `user:${user.id}`;
    await this.cache.set(
      cacheKey,
      {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      300
    );
  }
}
