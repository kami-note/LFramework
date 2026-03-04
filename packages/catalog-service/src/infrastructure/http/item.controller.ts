import { Request, Response } from "express";
import { CreateItemUseCase } from "../../application/use-cases/create-item.use-case";
import { ListItemsUseCase } from "../../application/use-cases/list-items.use-case";
import { InvalidItemError } from "../../application/errors";
import type { CreateItemDto } from "../../application/dtos/create-item.dto";
import type { ErrorResponseDto } from "../../application/dtos/error-response.dto";

export class ItemController {
  constructor(
    private readonly createItemUseCase: CreateItemUseCase,
    private readonly listItemsUseCase: ListItemsUseCase
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: CreateItemDto = req.body;
      const result = await this.createItemUseCase.execute(dto);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof InvalidItemError) {
        const body: ErrorResponseDto = { error: err.message };
        res.status(400).json(body);
        return;
      }
      const body: ErrorResponseDto = { error: "Internal server error" };
      res.status(500).json(body);
    }
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.listItemsUseCase.execute();
      res.json(items);
    } catch {
      const body: ErrorResponseDto = { error: "Internal server error" };
      res.status(500).json(body);
    }
  };
}
