import { PrismaClient } from "../../../generated/prisma-client";
import type { IUserOAuthRegistrationPersistence } from "../../domain/repository-interfaces/user-oauth-registration-persistence.interface";
import type { OAuthProvider } from "../../domain/repository-interfaces/oauth-account-repository.interface";
import { User } from "../../domain/entities/user.entity";
import { UserAlreadyExistsError } from "../../application/errors";

function isPrismaP2002(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/**
 * Adapter: persiste usuário e conta OAuth em uma única transação.
 */
export class PrismaUserOAuthRegistrationPersistence implements IUserOAuthRegistrationPersistence {
  constructor(private readonly prisma: PrismaClient) {}

  async saveUserAndOAuthAccount(
    user: User,
    provider: OAuthProvider,
    providerId: string
  ): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.userModel.create({
          data: {
            id: user.id,
            email: user.email.value,
            name: user.name,
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
      ]);
    } catch (err) {
      if (isPrismaP2002(err)) {
        throw new UserAlreadyExistsError("User with this email already exists");
      }
      throw err;
    }
  }
}
