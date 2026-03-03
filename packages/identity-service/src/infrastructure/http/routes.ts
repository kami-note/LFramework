import { Router } from "express";
import { UserController } from "./user.controller";

export function createUserRoutes(controller: UserController): Router {
  const router = Router();
  router.post("/users", controller.create);
  router.get("/users/:id", controller.getById);
  return router;
}
