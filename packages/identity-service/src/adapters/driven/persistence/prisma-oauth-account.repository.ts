import { PrismaClient } from "../../../../generated/prisma-client";
import type { IOAuthAccountRepository, OAuthProvider } from "../../../application/ports/oauth-account-repository.port";

export class PrismaOAuthAccountRepository implements IOAuthAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProviderAndProviderId(
    provider: OAuthProvider,
    providerId: string
  ): Promise<{ userId: string } | null> {
    const row = await this.prisma.oAuthAccountModel.findUnique({
      where: {
        provider_providerId: { provider, providerId },
      },
      select: { userId: true },
    });
    return row ?? null;
  }

  async save(userId: string, provider: OAuthProvider, providerId: string): Promise<void> {
    await this.prisma.oAuthAccountModel.upsert({
      where: {
        provider_providerId: { provider, providerId },
      },
      create: { userId, provider, providerId, createdAt: new Date() },
      update: {},
    });
  }
}
