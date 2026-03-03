import { randomUUID } from "crypto";
import { User } from "../../domain/entities/user.entity";
import { Email } from "../../domain/value-objects/email.vo";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { IUserRegistrationPersistence } from "../../domain/repository-interfaces/user-registration-persistence.interface";
import type { IPasswordHasher } from "../ports/password-hasher.port";
import type { ITokenService } from "../ports/token-service.port";
import type { IEventPublisher } from "../ports/event-publisher.port";
import type { ICacheService } from "@lframework/shared";
import { USER_CREATED_EVENT } from "@lframework/shared";
import type { RegisterDto } from "../dtos/register.dto";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export interface RegisterResult {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  accessToken: string;
}

export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly registrationPersistence: IUserRegistrationPersistence,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
    private readonly cache: ICacheService,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async execute(dto: RegisterDto): Promise<RegisterResult> {
    if (!dto.password || dto.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error("Password must be at least 8 characters");
    }
    if (dto.password.length > MAX_PASSWORD_LENGTH) {
      throw new Error("Password must be at most 128 characters");
    }
    const email = Email.create(dto.email);
    const existing = await this.userRepository.findByEmail(email.value);
    if (existing) {
      throw new Error("User with this email already exists");
    }

    const id = randomUUID();
    const user = User.create(id, email, dto.name);
    const passwordHash = await this.passwordHasher.hash(dto.password);

    await this.registrationPersistence.saveUserAndCredential(user, passwordHash);

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
    };
  }
}
