import { PrismaClient } from "../../../generated/prisma-client";
import type { IUserRegistrationPersistence } from "../../domain/repository-interfaces/user-registration-persistence.interface";
import { User } from "../../domain/entities/user.entity";

/**
 * Adapter: persiste usuário e credencial em uma única transação.
 */
export class PrismaUserRegistrationPersistence implements IUserRegistrationPersistence {
  constructor(private readonly prisma: PrismaClient) {}

  async saveUserAndCredential(user: User, passwordHash: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userModel.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email.value,
          name: user.name,
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
  }
}
