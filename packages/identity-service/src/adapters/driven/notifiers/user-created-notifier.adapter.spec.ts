import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserCreatedNotifierAdapter } from "./user-created-notifier.adapter";

describe("UserCreatedNotifierAdapter", () => {
  let cache: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    cache = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      publish: vi.fn(),
    };
  });

  it("sets cache with user key and 300s TTL", async () => {
    const adapter = new UserCreatedNotifierAdapter(cache as never);
    const user = {
      id: "user-123",
      email: "u@example.com",
      name: "User Name",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    await adapter.notify(user);

    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith("user:user-123", {
      id: "user-123",
      email: "u@example.com",
      name: "User Name",
      createdAt: "2025-01-01T00:00:00.000Z",
    }, 300);
  });

  it("does not call publish (events via outbox)", async () => {
    const adapter = new UserCreatedNotifierAdapter(cache as never);
    await adapter.notify({
      id: "id",
      email: "e@e.com",
      name: "N",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(cache.set).toHaveBeenCalled();
    expect(cache.publish).not.toHaveBeenCalled();
  });
});
