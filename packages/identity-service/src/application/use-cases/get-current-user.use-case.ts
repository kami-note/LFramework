import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import type { UserResponseDto } from "../dtos/user-response.dto";

export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;
    const dto: UserResponseDto = {
      id: user.id,
      email: user.email.value,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
    return dto;
  }
}
