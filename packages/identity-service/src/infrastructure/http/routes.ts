import { Router, Request, Response, NextFunction } from "express";
import { UserController } from "./user.controller";
import { validateCreateUser } from "./user.validation";
import { requireRole } from "./auth.middleware";

export function createUserRoutes(
  controller: UserController,
  authMiddleware: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();
  router.post("/users", validateCreateUser, authMiddleware, requireRole("admin"), controller.create);
  router.get("/users/:id", authMiddleware, controller.getById);
  return router;
}
