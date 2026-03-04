import { PrismaClient } from "../../../generated/prisma-client";
import type { IUserRegistrationPersistence } from "../../domain/repository-interfaces/user-registration-persistence.interface";
import { User } from "../../domain/entities/user.entity";
import { UserAlreadyExistsError } from "../../application/errors";

function isPrismaP2002(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/**
 * Adapter: persiste usuário e credencial em uma única transação.
 */
export class PrismaUserRegistrationPersistence implements IUserRegistrationPersistence {
  constructor(private readonly prisma: PrismaClient) {}

  async saveUserAndCredential(user: User, passwordHash: string): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.userModel.upsert({
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
        }),
        this.prisma.authCredentialModel.upsert({
          where: { userId: user.id },
          create: { userId: user.id, passwordHash },
          update: { passwordHash },
        }),
      ]);
    } catch (err) {
      if (isPrismaP2002(err)) {
        throw new UserAlreadyExistsError("User with this email already exists");
      }
      throw err;
    }
  }
}
