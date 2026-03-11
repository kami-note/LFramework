import { PrismaClient } from "../../../../generated/prisma-client";
import type { IAuthCredentialRepository } from "../../../application/ports/auth-credential-repository.port";

export class PrismaAuthCredentialRepository implements IAuthCredentialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.authCredentialModel.upsert({
      where: { userId },
      create: { userId, passwordHash },
      update: { passwordHash },
    });
  }

  async getPasswordHashByUserId(userId: string): Promise<string | null> {
    const row = await this.prisma.authCredentialModel.findUnique({
      where: { userId },
    });
    return row?.passwordHash ?? null;
  }
}
