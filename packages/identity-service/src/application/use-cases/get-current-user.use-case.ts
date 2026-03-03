import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";

export interface CurrentUserResult {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<CurrentUserResult | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email.value,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
