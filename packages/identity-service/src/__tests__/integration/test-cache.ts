import type { ICacheService } from "@lframework/shared";

/**
 * No-op cache for integration tests so Redis is not required for register/login.
 */
export function createNoOpCache(): ICacheService {
  return {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
  };
}
