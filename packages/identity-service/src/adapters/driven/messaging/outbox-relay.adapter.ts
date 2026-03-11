import { logger } from "@lframework/shared";
import type { PrismaClient } from "../../../../generated/prisma-client";
import type { IEventPublisher } from "../../../application/ports/event-publisher.port";

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_INTERVAL_MS = 2_000;

/**
 * Reads unpublished outbox rows, publishes to the message broker, and marks them as published.
 * Run periodically so events are eventually published (Outbox Pattern).
 */
export class OutboxRelayAdapter {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly eventPublisher: IEventPublisher,
    private readonly batchSize: number = DEFAULT_BATCH_SIZE
  ) {}

  /**
   * Process one batch of unpublished outbox rows.
   * Call this from a scheduler or use start() for an in-process interval.
   */
  async runOnce(): Promise<void> {
    const rows = await this.prisma.outboxModel.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: this.batchSize,
    });

    for (const row of rows) {
      try {
        const raw = row.payload;
        let payload: object;
        if (raw == null || typeof raw !== "object") {
          if (typeof raw === "string") {
            try {
              const parsed = JSON.parse(raw);
              if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
                payload = parsed as object;
              } else {
                logger.warn({ outboxId: row.id, eventName: row.eventName }, "Outbox relay: parsed payload is not a plain object, skipping");
                continue;
              }
            } catch {
              logger.warn({ outboxId: row.id, eventName: row.eventName }, "Outbox relay: payload is invalid JSON string, skipping");
              continue;
            }
          } else {
            logger.warn({ outboxId: row.id, eventName: row.eventName }, "Outbox relay: payload is null or not an object, skipping");
            continue;
          }
        } else {
          payload = raw as object;
        }
        await this.eventPublisher.publish(row.eventName, payload);
        await this.prisma.outboxModel.update({
          where: { id: row.id },
          data: { publishedAt: new Date() },
        });
      } catch (err) {
        logger.warn({ err, outboxId: row.id, eventName: row.eventName }, "Outbox relay: publish failed, will retry");
        // Do not mark as published; next run will retry.
      }
    }
  }

  /**
   * Start the relay loop. Call after connectRabbitMQ().
   */
  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (this.timeoutId != null) {
      return;
    }
    this.stopped = false;
    const scheduleNext = (): void => {
      if (this.stopped) return;
      this.timeoutId = setTimeout(() => {
        this.runOnce()
          .catch((err) => logger.error({ err }, "Outbox relay runOnce failed"))
          .finally(() => {
            this.timeoutId = null;
            if (!this.stopped) scheduleNext();
          });
      }, intervalMs);
    };
    scheduleNext();
    logger.info({ intervalMs }, "Outbox relay started");
  }

  /**
   * Stop the relay loop. Call before disconnect.
   */
  stop(): void {
    this.stopped = true;
    if (this.timeoutId != null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
      logger.info("Outbox relay stopped");
    }
  }
}
