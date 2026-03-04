import { randomUUID } from "crypto";
import { User } from "../../domain/entities/user.entity";
import { Email } from "../../domain/value-objects/email.vo";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { IOAuthAccountRepository } from "../../domain/repository-interfaces/oauth-account-repository.interface";
import type { IUserOAuthRegistrationPersistence } from "../../domain/repository-interfaces/user-oauth-registration-persistence.interface";
import type { IOAuthProvider } from "../ports/oauth-provider.port";
import type { ITokenService } from "../ports/token-service.port";
import type { IUserCreatedNotifier } from "../ports/user-created-notifier.port";
import type { OAuthCallbackResponseDto } from "../dtos/oauth-callback-response.dto";

export type OAuthCallbackResultDto = Omit<OAuthCallbackResponseDto, "expiresIn">;

export class OAuthCallbackUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly oauthAccountRepository: IOAuthAccountRepository,
    private readonly userOAuthRegistrationPersistence: IUserOAuthRegistrationPersistence,
    private readonly tokenService: ITokenService,
    private readonly userCreatedNotifier: IUserCreatedNotifier
  ) {}

  async execute(
    code: string,
    redirectUri: string,
    provider: IOAuthProvider
  ): Promise<OAuthCallbackResultDto> {
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
        role: user.role,
      });
      return {
        user: {
          id: user.id,
          email: user.email.value,
          name: user.name,
          createdAt: user.createdAt.toISOString(),
          isNewUser: false,
        },
        accessToken,
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

      await this.userCreatedNotifier.notify({
        id: user.id,
        email: user.email.value,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      });
    } else {
      await this.oauthAccountRepository.save(user.id, provider.provider, userInfo.providerId);
    }

    const accessToken = this.tokenService.sign({
      sub: user.id,
      email: user.email.value,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email.value,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        isNewUser,
      },
      accessToken,
    };
  }
}
