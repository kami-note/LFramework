import { randomUUID } from "crypto";
import { User } from "../../domain/entities/user.entity";
import { Email } from "../../domain/value-objects/email.vo";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { IUserRegistrationPersistence } from "../../domain/repository-interfaces/user-registration-persistence.interface";
import type { IPasswordHasher } from "../ports/password-hasher.port";
import type { ITokenService } from "../ports/token-service.port";
import type { IUserCreatedNotifier } from "../ports/user-created-notifier.port";
import type { RegisterDto } from "../dtos/register.dto";
import type { AuthUserDto } from "../dtos/auth-response.dto";
import {
  UserAlreadyExistsError,
  InvalidEmailError,
} from "../errors";

export interface RegisterResultDto {
  user: AuthUserDto;
  accessToken: string;
}

export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly registrationPersistence: IUserRegistrationPersistence,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
    private readonly userCreatedNotifier: IUserCreatedNotifier
  ) {}

  /**
   * Email.create lança Error("Invalid email") em falha de validação.
   * Pode lançar TypeError se value for null/undefined. Apenas erros de
   * validação são convertidos para InvalidEmailError; demais são rethrown.
   */
  async execute(dto: RegisterDto): Promise<RegisterResultDto> {
    let email: Email;
    try {
      email = Email.create(dto.email);
    } catch (err) {
      if (err instanceof Error && err.message === "Invalid email") {
        throw new InvalidEmailError("Invalid email");
      }
      throw err;
    }
    const existing = await this.userRepository.findByEmail(email.value);
    if (existing) {
      throw new UserAlreadyExistsError("User with this email already exists");
    }

    const id = randomUUID();
    const user = User.create(id, email, dto.name);
    const passwordHash = await this.passwordHasher.hash(dto.password);

    await this.registrationPersistence.saveUserAndCredential(user, passwordHash);

    await this.userCreatedNotifier.notify({
      id: user.id,
      email: user.email.value,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    });

    const accessToken = this.tokenService.sign({
      sub: user.id,
      email: user.email.value,
      role: "user",
    });

    return {
      user: {
        id: user.id,
        email: user.email.value,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
      accessToken,
    };
  }
}
