import { Request, Response } from "express";
import { CreateUserUseCase } from "../../application/use-cases/create-user.use-case";
import { GetUserByIdUseCase } from "../../application/use-cases/get-user-by-id.use-case";
import {
  UserAlreadyExistsError,
  InvalidEmailError,
} from "../../application/errors";
import type { CreateUserDto } from "../../application/dtos/create-user.dto";
import type { ErrorResponseDto } from "../../application/dtos/error-response.dto";

/**
 * Adapter (entrada): controller HTTP que delega aos casos de uso.
 */
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: CreateUserDto = req.body;
      const result = await this.createUserUseCase.execute(dto);
      res.status(201).json(result);
    } catch (err) {
      const errorBody: ErrorResponseDto = { error: err instanceof Error ? err.message : "Internal server error" };
      if (err instanceof UserAlreadyExistsError) {
        res.status(409).json(errorBody);
        return;
      }
      if (err instanceof InvalidEmailError) {
        res.status(400).json(errorBody);
        return;
      }
      res.status(500).json({ error: "Internal server error" } as ErrorResponseDto);
    }
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = await this.getUserByIdUseCase.execute(id);
      if (!user) {
        res.status(404).json({ error: "User not found" } as ErrorResponseDto);
        return;
      }
      res.json(user);
    } catch {
      res.status(500).json({ error: "Internal server error" } as ErrorResponseDto);
    }
  };
}
