import { randomUUID } from "crypto";
import { User } from "../../domain/entities/user.entity";
import { Email } from "../../domain/value-objects/email.vo";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { ICacheService } from "@lframework/shared";
import type { IEventPublisher } from "../ports/event-publisher.port";
import type { CreateUserDto } from "../dtos/create-user.dto";
import type { UserResponseDto } from "../dtos/user-response.dto";
import { publishUserCreatedAndCache } from "../services/user-created-notify";
import { UserAlreadyExistsError, InvalidEmailError } from "../errors";

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cache: ICacheService,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async execute(dto: CreateUserDto): Promise<UserResponseDto> {
    let email: Email;
    try {
      email = Email.create(dto.email);
    } catch {
      throw new InvalidEmailError("Invalid email");
    }
    const existing = await this.userRepository.findByEmail(email.value);
    if (existing) {
      throw new UserAlreadyExistsError("User with this email already exists");
    }

    const id = randomUUID();
    const user = User.create(id, email, dto.name);
    await this.userRepository.save(user);

    await publishUserCreatedAndCache(
      {
        id: user.id,
        email: user.email.value,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
      this.eventPublisher,
      this.cache
    );

    const result: UserResponseDto = {
      id: user.id,
      email: user.email.value,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
    return result;
  }
}
