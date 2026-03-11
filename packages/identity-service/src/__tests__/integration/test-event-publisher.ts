import type { TestEventPublisher } from "../../container";

/**
 * No-op event publisher for integration tests so RabbitMQ is not required.
 */
export function createNoOpEventPublisher(): TestEventPublisher {
  return {
    publish: async () => {},
    connect: async () => {},
    disconnect: async () => {},
  };
}
