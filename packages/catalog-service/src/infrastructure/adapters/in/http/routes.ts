import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler } from "@lframework/shared";
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
  router.get("/items", asyncHandler(controller.list.bind(controller)));
  router.post("/items", authMiddleware, validateCreateItem, asyncHandler(controller.create.bind(controller)));
  return router;
}
