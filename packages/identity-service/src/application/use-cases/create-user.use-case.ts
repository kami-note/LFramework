import { randomUUID } from "crypto";
import { User } from "../../domain/entities/user.entity";
import { Email } from "../../domain/value-objects/email.vo";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { ICacheService } from "../ports/cache.port";
import type { IEventPublisher } from "../ports/event-publisher.port";
import type { CreateUserDto } from "../dtos/create-user.dto";
import { USER_CREATED_EVENT } from "@lframework/shared";

export interface CreateUserUseCaseResult {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cache: ICacheService,
    private readonly eventPublisher: IEventPublisher
  ) {}

  async execute(dto: CreateUserDto): Promise<CreateUserUseCaseResult> {
    const email = Email.create(dto.email);
    const existing = await this.userRepository.findByEmail(email.value);
    if (existing) {
      throw new Error("User with this email already exists");
    }

    const id = randomUUID();
    const user = User.create(id, email, dto.name);
    await this.userRepository.save(user);

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

    return {
      id: user.id,
      email: user.email.value,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
