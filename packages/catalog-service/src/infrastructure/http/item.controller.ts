import { Request, Response } from "express";
import { CreateItemUseCase } from "../../application/use-cases/create-item.use-case";
import { ListItemsUseCase } from "../../application/use-cases/list-items.use-case";
import { InvalidItemError } from "../../application/errors";
import type { CreateItemDto } from "../../application/dtos/create-item.dto";
import type { AuthenticatedRequest } from "./auth.middleware";
import { sendError } from "@lframework/shared";

export class ItemController {
  constructor(
    private readonly createItemUseCase: CreateItemUseCase,
    private readonly listItemsUseCase: ListItemsUseCase
  ) {}

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const dto: CreateItemDto = req.body;
      const result = await this.createItemUseCase.execute(dto);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof InvalidItemError) {
        sendError(res, 400, err.message);
        return;
      }
      sendError(res, 500, "Internal server error");
    }
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.listItemsUseCase.execute();
      res.json(items);
    } catch {
      sendError(res, 500, "Internal server error");
    }
  };
}
