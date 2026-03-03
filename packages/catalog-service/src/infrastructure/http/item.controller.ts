import { Request, Response } from "express";
import { CreateItemUseCase } from "../../application/use-cases/create-item.use-case";
import { ListItemsUseCase } from "../../application/use-cases/list-items.use-case";
import { InvalidItemError } from "../../application/errors";
import type { CreateItemDto } from "../../application/dtos/create-item.dto";

export class ItemController {
  constructor(
    private readonly createItemUseCase: CreateItemUseCase,
    private readonly listItemsUseCase: ListItemsUseCase
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: CreateItemDto = req.body;
      const result = await this.createItemUseCase.execute(dto);
      res.status(201).json({
        id: result.id,
        name: result.name,
        priceAmount: result.priceAmount,
        priceCurrency: result.priceCurrency,
        createdAt: result.createdAt.toISOString(),
      });
    } catch (err) {
      if (err instanceof InvalidItemError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    }
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.listItemsUseCase.execute();
      res.json(items);
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
