import { randomUUID } from "crypto";
import { PrismaClient } from "../../../../generated/prisma-client";
import type { IUserRegistrationPersistence } from "../../../application/ports/user-registration-persistence.port";
import type { OutboxEvent } from "../../../application/ports/outbox-writer.port";
import { User } from "../../../domain/entities/user.entity";
import { UserAlreadyExistsError } from "../../../application/errors";

function isPrismaP2002(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/**
 * Adapter: persiste usuário e credencial em uma única transação.
 * Optionally appends an outbox event in the same transaction (Outbox Pattern).
 */
export class PrismaUserRegistrationPersistence implements IUserRegistrationPersistence {
  constructor(private readonly prisma: PrismaClient) {}

  async saveUserAndCredential(
    user: User,
    passwordHash: string,
    outboxEvent?: OutboxEvent
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.userModel.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            email: user.email.value,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
          },
          update: {
            email: user.email.value,
            name: user.name,
          },
        });
        await tx.authCredentialModel.upsert({
          where: { userId: user.id },
          create: { userId: user.id, passwordHash },
          update: { passwordHash },
        });
        if (outboxEvent) {
          await tx.outboxModel.create({
            data: {
              id: randomUUID(),
              eventName: outboxEvent.eventName,
              payload: outboxEvent.payload as object,
              createdAt: new Date(),
            },
          });
        }
      });
    } catch (err) {
      if (isPrismaP2002(err)) {
        throw new UserAlreadyExistsError("User with this email already exists");
      }
      throw err;
    }
  }
}
