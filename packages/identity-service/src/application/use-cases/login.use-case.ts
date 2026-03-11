import type { IUserRepository } from "../ports/user-repository.port";
import type { IAuthCredentialRepository } from "../ports/auth-credential-repository.port";
import type { IPasswordHasher } from "../ports/password-hasher.port";
import type { ITokenService } from "../ports/token-service.port";
import type { LoginDto } from "../dtos/login.dto";
import type { AuthUserDto } from "../dtos/auth-response.dto";
import { InvalidCredentialsError } from "../errors";

export interface LoginResultDto {
  user: AuthUserDto;
  accessToken: string;
}

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly authCredentialRepository: IAuthCredentialRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  async execute(dto: LoginDto): Promise<LoginResultDto> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new InvalidCredentialsError("Invalid email or password");
    }

    const hash = await this.authCredentialRepository.getPasswordHashByUserId(user.id);
    if (!hash) {
      throw new InvalidCredentialsError("Invalid email or password");
    }

    const valid = await this.passwordHasher.verify(dto.password, hash);
    if (!valid) {
      throw new InvalidCredentialsError("Invalid email or password");
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
      },
      accessToken,
    };
  }
}
