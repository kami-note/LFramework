import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { CreateUserUseCase } from "../../../../application/use-cases/create-user.use-case";
import { GetUserByIdUseCase } from "../../../../application/use-cases/get-user-by-id.use-case";
import type { CreateUserDto } from "../../../../application/dtos/create-user.dto";
import type { AuthenticatedRequest } from "@lframework/shared";
import { sendError } from "@lframework/shared";

const uuidParamSchema = z.string().uuid();

/**
 * Adapter (entrada): controller HTTP que delega aos casos de uso.
 * Rotas protegidas por authMiddleware (+ requireRole em create).
 */
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto: CreateUserDto = authReq.body;
      const result = await this.createUserUseCase.execute(dto);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = authReq.params;
      const parsed = uuidParamSchema.safeParse(id);
      if (!parsed.success) {
        sendError(res, 400, "Invalid user id format");
        return;
      }
      const userId = parsed.data;
      if (authReq.userId !== userId && authReq.userRole !== "admin") {
        sendError(res, 403, "Forbidden");
        return;
      }
      const user = await this.getUserByIdUseCase.execute(userId);
      if (!user) {
        sendError(res, 404, "User not found");
        return;
      }
      res.json(user);
    } catch (err) {
      next(err);
    }
  };
}
