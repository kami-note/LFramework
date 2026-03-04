import { Response } from "express";
import { z } from "zod";
import { CreateUserUseCase } from "../../application/use-cases/create-user.use-case";
import { GetUserByIdUseCase } from "../../application/use-cases/get-user-by-id.use-case";
import { mapApplicationErrorToHttp } from "../../application/http/error-to-http.mapper";
import type { CreateUserDto } from "../../application/dtos/create-user.dto";
import type { AuthenticatedRequest } from "@lframework/shared";
import { sendError, logger, type RequestWithRequestId } from "@lframework/shared";

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

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const dto: CreateUserDto = req.body;
      const result = await this.createUserUseCase.execute(dto);
      res.status(201).json(result);
    } catch (err) {
      const { statusCode, message } = mapApplicationErrorToHttp(err);
      sendError(res, statusCode, message);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const parsed = uuidParamSchema.safeParse(id);
      if (!parsed.success) {
        sendError(res, 400, "Invalid user id format");
        return;
      }
      const userId = parsed.data;
      if (req.userId !== userId && req.userRole !== "admin") {
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
      const requestId = (req as RequestWithRequestId).requestId;
      logger.error({ err, requestId }, "getUserById failed");
      sendError(res, 500, "Internal server error");
    }
  };
}
