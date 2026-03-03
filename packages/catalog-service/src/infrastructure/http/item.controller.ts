import { Request, Response } from "express";
import { CreateItemUseCase } from "../../application/use-cases/create-item.use-case";
import { ListItemsUseCase } from "../../application/use-cases/list-items.use-case";

export class ItemController {
  constructor(
    private readonly createItemUseCase: CreateItemUseCase,
    private readonly listItemsUseCase: ListItemsUseCase
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, priceAmount, priceCurrency } = req.body;
      if (!name || priceAmount == null) {
        res.status(400).json({ error: "name and priceAmount are required" });
        return;
      }
      const result = await this.createItemUseCase.execute({
        name,
        priceAmount: Number(priceAmount),
        priceCurrency,
      });
      res.status(201).json({
        id: result.id,
        name: result.name,
        priceAmount: result.priceAmount,
        priceCurrency: result.priceCurrency,
        createdAt: result.createdAt.toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("negative") || message.includes("Invalid")) {
        res.status(400).json({ error: message });
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
