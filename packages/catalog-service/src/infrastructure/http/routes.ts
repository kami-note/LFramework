import { Router } from "express";
import { ItemController } from "./item.controller";

export function createItemRoutes(controller: ItemController): Router {
  const router = Router();
  router.post("/items", controller.create);
  router.get("/items", controller.list);
  return router;
}
