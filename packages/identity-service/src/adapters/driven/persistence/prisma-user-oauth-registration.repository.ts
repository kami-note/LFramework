import { randomUUID } from "crypto";
import { PrismaClient } from "../../../../generated/prisma-client";
import type { IUserOAuthRegistrationPersistence } from "../../../application/ports/user-oauth-registration-persistence.port";
import type { OAuthProvider } from "../../../application/ports/oauth-account-repository.port";
import type { OutboxEvent } from "../../../application/ports/outbox-writer.port";
import { User } from "../../../domain/entities/user.entity";
import { UserAlreadyExistsError } from "../../../application/errors";

function isPrismaP2002(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/**
 * Adapter: persiste usuário e conta OAuth em uma única transação.
 * Optionally appends an outbox event in the same transaction (Outbox Pattern).
 */
export class PrismaUserOAuthRegistrationPersistence implements IUserOAuthRegistrationPersistence {
  constructor(private readonly prisma: PrismaClient) {}

  async saveUserAndOAuthAccount(
    user: User,
    provider: OAuthProvider,
    providerId: string,
    outboxEvent?: OutboxEvent
  ): Promise<void> {
    try {
      const ops: Promise<unknown>[] = [
        this.prisma.userModel.create({
          data: {
            id: user.id,
            email: user.email.value,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
          },
        }),
        this.prisma.oAuthAccountModel.create({
          data: {
            userId: user.id,
            provider,
            providerId,
            createdAt: new Date(),
          },
        }),
      ];
      if (outboxEvent) {
        ops.push(
          this.prisma.outboxModel.create({
            data: {
              id: randomUUID(),
              eventName: outboxEvent.eventName,
              payload: outboxEvent.payload as object,
              createdAt: new Date(),
            },
          })
        );
      }
      await this.prisma.$transaction(ops);
    } catch (err) {
      if (isPrismaP2002(err)) {
        throw new UserAlreadyExistsError("User with this email already exists");
      }
      throw err;
    }
  }
}
