import type { TestEventConsumer } from "../../container";

/**
 * No-op event consumer for integration tests so RabbitMQ is not required.
 */
export function createNoOpEventConsumer(): TestEventConsumer {
  return {
    start: async () => {},
    close: async () => {},
  };
}
