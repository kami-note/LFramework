import { Prisma } from "@prisma/client";
import { PrismaClient } from "../../../../generated/prisma-client";
import type { IReplicatedUserStore } from "../../../application/ports/replicated-user-store.port";
import type { UserCreatedPayload } from "@lframework/shared";

/**
 * Adapter: replicates user data from user.created events into local table (Data Replication).
 */
export class PrismaReplicatedUserStore implements IReplicatedUserStore {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertFromUserCreated(payload: UserCreatedPayload): Promise<void> {
    const now = new Date();
    let occurredAt: Date;
    if (payload.occurredAt != null && payload.occurredAt !== "") {
      occurredAt = new Date(payload.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        occurredAt = now;
      }
    } else {
      occurredAt = now;
    }

    const updated = await this.prisma.replicatedUserModel.updateMany({
      where: {
        id: payload.userId,
        OR: [
          { lastEventOccurredAt: { lte: occurredAt } },
          { lastEventOccurredAt: null },
        ],
      },
      data: {
        email: payload.email,
        name: payload.name,
        lastEventAt: now,
        lastEventOccurredAt: occurredAt,
      },
    });

    if (updated.count === 0) {
      const existing = await this.prisma.replicatedUserModel.findUnique({
        where: { id: payload.userId },
      });
      if (!existing) {
        try {
          await this.prisma.replicatedUserModel.create({
            data: {
              id: payload.userId,
              email: payload.email,
              name: payload.name,
              createdAt: occurredAt,
              lastEventAt: now,
              lastEventOccurredAt: occurredAt,
            },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            // Benign race: another concurrent insert created the row; skip.
            return;
          }
          throw err;
        }
      }
      // else: row exists with newer lastEventOccurredAt — skip (stale/delayed event)
    }
  }
}
