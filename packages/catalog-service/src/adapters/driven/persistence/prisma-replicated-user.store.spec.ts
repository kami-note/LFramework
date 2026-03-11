import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaReplicatedUserStore } from "./prisma-replicated-user.store";

describe("PrismaReplicatedUserStore", () => {
  const mockUpdateMany = vi.fn();
  const mockFindUnique = vi.fn();
  const mockCreate = vi.fn().mockResolvedValue(undefined);
  const mockPrisma = {
    replicatedUserModel: {
      updateMany: mockUpdateMany,
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates row when user does not exist", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue(null);

    const store = new PrismaReplicatedUserStore(mockPrisma as never);
    const payload = {
      userId: "user-1",
      email: "u@example.com",
      name: "User One",
      occurredAt: "2025-01-15T10:00:00.000Z",
    };

    await store.upsertFromUserCreated(payload);

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "user-1",
        OR: [
          { lastEventOccurredAt: { lte: new Date(payload.occurredAt) } },
          { lastEventOccurredAt: null },
        ],
      },
      data: expect.objectContaining({
        email: "u@example.com",
        name: "User One",
        lastEventOccurredAt: new Date(payload.occurredAt),
      }),
    });
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "user-1",
        email: "u@example.com",
        name: "User One",
        createdAt: new Date(payload.occurredAt),
        lastEventOccurredAt: new Date(payload.occurredAt),
      }),
    });
  });

  it("updates row when user exists and event is newer or equal", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const store = new PrismaReplicatedUserStore(mockPrisma as never);
    const payload = {
      userId: "user-2",
      email: "updated@example.com",
      name: "Updated Name",
      occurredAt: "2025-02-01T12:00:00.000Z",
    };

    await store.upsertFromUserCreated(payload);

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "user-2",
          OR: [
            { lastEventOccurredAt: { lte: new Date(payload.occurredAt) } },
            { lastEventOccurredAt: null },
          ],
        },
        data: expect.objectContaining({
          email: "updated@example.com",
          name: "Updated Name",
          lastEventOccurredAt: new Date(payload.occurredAt),
        }),
      })
    );
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("skips when user exists with newer lastEventOccurredAt (stale event)", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindUnique.mockResolvedValue({
      id: "user-3",
      email: "current@example.com",
      name: "Current",
      lastEventOccurredAt: new Date("2025-03-01T00:00:00.000Z"),
    });

    const store = new PrismaReplicatedUserStore(mockPrisma as never);
    const payload = {
      userId: "user-3",
      email: "stale@example.com",
      name: "Stale Name",
      occurredAt: "2025-02-01T12:00:00.000Z",
    };

    await store.upsertFromUserCreated(payload);

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "user-3" } });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
