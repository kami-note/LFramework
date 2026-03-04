import { Request, Response } from "express";
import { CreateItemUseCase } from "../../application/use-cases/create-item.use-case";
import { ListItemsUseCase } from "../../application/use-cases/list-items.use-case";
import { mapApplicationErrorToHttp } from "../../application/http/error-to-http.mapper";
import type { CreateItemDto } from "../../application/dtos/create-item.dto";
import type { AuthenticatedRequest } from "@lframework/shared";
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
      const { statusCode, message } = mapApplicationErrorToHttp(err);
      sendError(res, statusCode, message);
    }
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.listItemsUseCase.execute();
      res.json(items);
    } catch (err) {
      const { statusCode, message } = mapApplicationErrorToHttp(err);
      sendError(res, statusCode, message);
    }
  };
}
