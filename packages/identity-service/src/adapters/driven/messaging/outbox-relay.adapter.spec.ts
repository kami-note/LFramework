import { describe, it, expect, vi, beforeEach } from "vitest";
import { OutboxRelayAdapter } from "./outbox-relay.adapter";

describe("OutboxRelayAdapter", () => {
  const mockPrisma = {
    outboxModel: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
  const mockEventPublisher = {
    publish: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when no unpublished rows exist", async () => {
    vi.mocked(mockPrisma.outboxModel.findMany).mockResolvedValue([]);
    const relay = new OutboxRelayAdapter(
      mockPrisma as never,
      mockEventPublisher as never,
      10
    );

    await relay.runOnce();

    expect(mockPrisma.outboxModel.findMany).toHaveBeenCalledWith({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: 10,
    });
    expect(mockEventPublisher.publish).not.toHaveBeenCalled();
    expect(mockPrisma.outboxModel.update).not.toHaveBeenCalled();
  });

  it("publishes each row and marks as published", async () => {
    const now = new Date();
    const rows = [
      {
        id: "outbox-1",
        eventName: "user.created",
        payload: { userId: "u1", email: "a@b.com" },
        createdAt: now,
        publishedAt: null,
      },
      {
        id: "outbox-2",
        eventName: "user.created",
        payload: { userId: "u2", email: "c@d.com" },
        createdAt: now,
        publishedAt: null,
      },
    ];
    vi.mocked(mockPrisma.outboxModel.findMany).mockResolvedValue(rows);
    vi.mocked(mockPrisma.outboxModel.update).mockResolvedValue({} as never);

    const relay = new OutboxRelayAdapter(
      mockPrisma as never,
      mockEventPublisher as never,
      50
    );

    await relay.runOnce();

    expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);
    expect(mockEventPublisher.publish).toHaveBeenNthCalledWith(
      1,
      "user.created",
      { userId: "u1", email: "a@b.com" }
    );
    expect(mockEventPublisher.publish).toHaveBeenNthCalledWith(
      2,
      "user.created",
      { userId: "u2", email: "c@d.com" }
    );
    expect(mockPrisma.outboxModel.update).toHaveBeenCalledWith({
      where: { id: "outbox-1" },
      data: { publishedAt: expect.any(Date) },
    });
    expect(mockPrisma.outboxModel.update).toHaveBeenCalledWith({
      where: { id: "outbox-2" },
      data: { publishedAt: expect.any(Date) },
    });
  });

  it("does not mark row as published when publish throws", async () => {
    const rows = [
      {
        id: "outbox-1",
        eventName: "user.created",
        payload: { userId: "u1" },
        createdAt: new Date(),
        publishedAt: null,
      },
    ];
    vi.mocked(mockPrisma.outboxModel.findMany).mockResolvedValue(rows);
    vi.mocked(mockEventPublisher.publish).mockRejectedValueOnce(new Error("Broker down"));

    const relay = new OutboxRelayAdapter(
      mockPrisma as never,
      mockEventPublisher as never
    );

    await relay.runOnce();

    expect(mockEventPublisher.publish).toHaveBeenCalledWith("user.created", { userId: "u1" });
    expect(mockPrisma.outboxModel.update).not.toHaveBeenCalled();
  });

  it("continues to next row when one publish fails", async () => {
    const rows = [
      {
        id: "outbox-1",
        eventName: "user.created",
        payload: { userId: "u1" },
        createdAt: new Date(),
        publishedAt: null,
      },
      {
        id: "outbox-2",
        eventName: "user.created",
        payload: { userId: "u2" },
        createdAt: new Date(),
        publishedAt: null,
      },
    ];
    vi.mocked(mockPrisma.outboxModel.findMany).mockResolvedValue(rows);
    vi.mocked(mockEventPublisher.publish)
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce(undefined);
    vi.mocked(mockPrisma.outboxModel.update).mockResolvedValue({} as never);

    const relay = new OutboxRelayAdapter(
      mockPrisma as never,
      mockEventPublisher as never
    );

    await relay.runOnce();

    expect(mockPrisma.outboxModel.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.outboxModel.update).toHaveBeenCalledWith({
      where: { id: "outbox-2" },
      data: { publishedAt: expect.any(Date) },
    });
  });

  it("start sets interval and stop clears it", () => {
    vi.useFakeTimers();
    vi.mocked(mockPrisma.outboxModel.findMany).mockResolvedValue([]);
    const relay = new OutboxRelayAdapter(
      mockPrisma as never,
      mockEventPublisher as never
    );

    relay.start(1000);
    expect(mockPrisma.outboxModel.findMany).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(mockPrisma.outboxModel.findMany).toHaveBeenCalled();

    relay.stop();
    vi.advanceTimersByTime(2000);
    expect(mockPrisma.outboxModel.findMany).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("start is idempotent (does not add second interval)", () => {
    vi.useFakeTimers();
    vi.mocked(mockPrisma.outboxModel.findMany).mockResolvedValue([]);
    const relay = new OutboxRelayAdapter(
      mockPrisma as never,
      mockEventPublisher as never
    );

    relay.start(1000);
    relay.start(1000);
    vi.advanceTimersByTime(1000);
    expect(mockPrisma.outboxModel.findMany).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
