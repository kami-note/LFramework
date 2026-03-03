import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { IAuthCredentialRepository } from "../../domain/repository-interfaces/auth-credential-repository.interface";
import type { IPasswordHasher } from "../ports/password-hasher.port";
import type { ITokenService } from "../ports/token-service.port";
import type { LoginDto } from "../dtos/login.dto";

export interface LoginResult {
  id: string;
  email: string;
  name: string;
  accessToken: string;
}

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly authCredentialRepository: IAuthCredentialRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  async execute(dto: LoginDto): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const hash = await this.authCredentialRepository.getPasswordHashByUserId(user.id);
    if (!hash) {
      throw new Error("Invalid email or password");
    }

    const valid = await this.passwordHasher.verify(dto.password, hash);
    if (!valid) {
      throw new Error("Invalid email or password");
    }

    const accessToken = this.tokenService.sign({
      sub: user.id,
      email: user.email.value,
    });

    return {
      id: user.id,
      email: user.email.value,
      name: user.name,
      accessToken,
    };
  }
}
