import type { ICacheService } from "../ports/cache.port";
import type { IEventPublisher } from "../ports/event-publisher.port";
import { USER_CREATED_EVENT } from "@lframework/shared";

export interface UserCreatedNotifyInput {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

/**
 * Publica o evento USER_CREATED e grava o usuário no cache.
 * Centraliza a lógica usada em CreateUserUseCase, RegisterUseCase e OAuthCallbackUseCase.
 */
export async function publishUserCreatedAndCache(
  user: UserCreatedNotifyInput,
  eventPublisher: IEventPublisher,
  cache: ICacheService
): Promise<void> {
  await eventPublisher.publish(USER_CREATED_EVENT, {
    userId: user.id,
    email: user.email,
    name: user.name,
    occurredAt: user.createdAt,
  });

  const cacheKey = `user:${user.id}`;
  await cache.set(
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
