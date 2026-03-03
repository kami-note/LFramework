import { randomUUID } from "crypto";
import { User } from "../../domain/entities/user.entity";
import { Email } from "../../domain/value-objects/email.vo";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { IOAuthAccountRepository } from "../../domain/repository-interfaces/oauth-account-repository.interface";
import type { IUserOAuthRegistrationPersistence } from "../../domain/repository-interfaces/user-oauth-registration-persistence.interface";
import type { IOAuthProvider } from "../ports/oauth-provider.port";
import type { ITokenService } from "../ports/token-service.port";
import type { ICacheService } from "@lframework/shared";
import type { IEventPublisher } from "../ports/event-publisher.port";
import { USER_CREATED_EVENT } from "@lframework/shared";

export interface OAuthCallbackResult {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  accessToken: string;
  isNewUser: boolean;
}

export class OAuthCallbackUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly oauthAccountRepository: IOAuthAccountRepository,
    private readonly userOAuthRegistrationPersistence: IUserOAuthRegistrationPersistence,
    private readonly tokenService: ITokenService,
    private readonly cache: ICacheService,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async execute(
    code: string,
    redirectUri: string,
    provider: IOAuthProvider
  ): Promise<OAuthCallbackResult> {
    const userInfo = await provider.getUserInfoFromCode(code, redirectUri);
    if (!userInfo) {
      throw new Error("Failed to get user info from OAuth provider");
    }

    const existingLink = await this.oauthAccountRepository.findByProviderAndProviderId(
      provider.provider,
      userInfo.providerId
    );

    if (existingLink) {
      const user = await this.userRepository.findById(existingLink.userId);
      if (!user) throw new Error("User not found");
      const accessToken = this.tokenService.sign({
        sub: user.id,
        email: user.email.value,
      });
      return {
        id: user.id,
        email: user.email.value,
        name: user.name,
        createdAt: user.createdAt,
        accessToken,
        isNewUser: false,
      };
    }

    const email = Email.create(userInfo.email);
    let user = await this.userRepository.findByEmail(email.value);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const id = randomUUID();
      user = User.create(id, email, userInfo.name);
      await this.userOAuthRegistrationPersistence.saveUserAndOAuthAccount(
        user,
        provider.provider,
        userInfo.providerId
      );

      await this.eventPublisher.publish(USER_CREATED_EVENT, {
        userId: user.id,
        email: user.email.value,
        name: user.name,
        occurredAt: user.createdAt.toISOString(),
      });

      const cacheKey = `user:${user.id}`;
      await this.cache.set(
        cacheKey,
        {
          id: user.id,
          email: user.email.value,
          name: user.name,
          createdAt: user.createdAt.toISOString(),
        },
        300
      );
    } else {
      await this.oauthAccountRepository.save(user.id, provider.provider, userInfo.providerId);
    }

    const accessToken = this.tokenService.sign({
      sub: user.id,
      email: user.email.value,
    });

    return {
      id: user.id,
      email: user.email.value,
      name: user.name,
      createdAt: user.createdAt,
      accessToken,
      isNewUser,
    };
  }
}
