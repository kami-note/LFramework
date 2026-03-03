import { Router, Request, Response, NextFunction } from "express";
import { UserController } from "./user.controller";

export function createUserRoutes(
  controller: UserController,
  authMiddleware: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();
  router.post("/users", authMiddleware, controller.create);
  router.get("/users/:id", authMiddleware, controller.getById);
  return router;
}
