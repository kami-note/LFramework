import { USER_CREATED_EVENT } from "@lframework/shared";
import type { IUserCreatedNotifier, UserCreatedNotifyInput } from "../../../../application/ports/user-created-notifier.port";
import type { IEventPublisher } from "../../../../application/ports/event-publisher.port";
import type { ICacheService } from "@lframework/shared";

/**
 * Adapter: publica USER_CREATED e grava usuário no cache.
 * Implementa a porta IUserCreatedNotifier (DIP).
 */
export class UserCreatedNotifierAdapter implements IUserCreatedNotifier {
  constructor(
    private readonly eventPublisher: IEventPublisher,
    private readonly cache: ICacheService
  ) {}

  async notify(user: UserCreatedNotifyInput): Promise<void> {
    await this.eventPublisher.publish(USER_CREATED_EVENT, {
      userId: user.id,
      email: user.email,
      name: user.name,
      occurredAt: user.createdAt,
    });

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
