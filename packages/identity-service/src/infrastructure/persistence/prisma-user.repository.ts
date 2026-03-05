import { Prisma } from "@prisma/client";
import { PrismaClient } from "../../../generated/prisma-client";
import { User } from "../../domain/entities/user.entity";
import type { IUserRepository } from "../../domain/repository-interfaces/user-repository.interface";
import { UserAlreadyExistsError } from "../../application/errors";

function isPrismaP2002(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/**
 * Adapter: implementação do repositório User com Prisma/PostgreSQL.
 */
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(user: User): Promise<void> {
    try {
      await this.prisma.userModel.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email.value,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      update: {
        email: user.email.value,
        name: user.name,
        role: user.role,
      },
    });
    } catch (err) {
      if (isPrismaP2002(err)) {
        throw new UserAlreadyExistsError("User with this email already exists");
      }
      throw err;
    }
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.userModel.findUnique({
      where: { id },
    });
    if (!row) return null;
    return User.reconstitute(row.id, row.email, row.name, row.createdAt, row.role);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.userModel.findUnique({
      where: { email },
    });
    if (!row) return null;
    return User.reconstitute(row.id, row.email, row.name, row.createdAt, row.role);
  }
}
