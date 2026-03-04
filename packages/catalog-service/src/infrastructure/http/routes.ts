import { Router, Request, Response, NextFunction } from "express";
import { ItemController } from "./item.controller";
import { validateCreateItem } from "./item.validation";

/**
 * Política de acesso: GET /api/items é público (listagem).
 * POST /api/items exige autenticação JWT (apenas usuários autenticados podem criar itens).
 */
export function createItemRoutes(
  controller: ItemController,
  authMiddleware: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();
  router.get("/items", controller.list);
  router.post("/items", authMiddleware, validateCreateItem, controller.create as (req: Request, res: Response) => Promise<void>);
  return router;
}
