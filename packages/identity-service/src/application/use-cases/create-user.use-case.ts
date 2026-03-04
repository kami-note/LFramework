import { randomUUID } from "crypto";
import { User } from "../../domain/entities/user.entity";
import { Email } from "../../domain/value-objects/email.vo";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { IUserCreatedNotifier } from "../ports/user-created-notifier.port";
import type { CreateUserDto } from "../dtos/create-user.dto";
import type { UserResponseDto } from "../dtos/user-response.dto";
import { UserAlreadyExistsError, InvalidEmailError } from "../errors";

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly userCreatedNotifier: IUserCreatedNotifier
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

    await this.userCreatedNotifier.notify({
      id: user.id,
      email: user.email.value,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    });

    const result: UserResponseDto = {
      id: user.id,
      email: user.email.value,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
    return result;
  }
}
