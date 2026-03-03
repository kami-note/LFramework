import { Router } from "express";
import { ItemController } from "./item.controller";
import { validateCreateItem } from "./item.validation";

export function createItemRoutes(controller: ItemController): Router {
  const router = Router();
  router.post("/items", validateCreateItem, controller.create);
  router.get("/items", controller.list);
  return router;
}
