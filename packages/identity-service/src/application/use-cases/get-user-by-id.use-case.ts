import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { ICacheService } from "@lframework/shared";
import { userResponseDtoSchema, type UserResponseDto } from "../dtos/user-response.dto";

export class GetUserByIdUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cache: ICacheService
  ) {}

  async execute(id: string): Promise<UserResponseDto | null> {
    const cacheKey = `user:${id}`;
    const cached = await this.cache.get(cacheKey, userResponseDtoSchema);
    if (cached) {
      return cached;
    }

    const user = await this.userRepository.findById(id);
    if (!user) {
      return null;
    }

    const dto: UserResponseDto = {
      id: user.id,
      email: user.email.value,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };

    await this.cache.set(cacheKey, dto, 300);
    return dto;
  }
}
