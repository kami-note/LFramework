import { Router, Request, Response, NextFunction } from "express";
import { UserController } from "./user.controller";
import { validateCreateUser } from "./user.validation";
import { requireRole } from "./auth.middleware";

export function createUserRoutes(
  controller: UserController,
  authMiddleware: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();
  router.post("/users", validateCreateUser, authMiddleware, requireRole("admin"), controller.create as (req: Request, res: Response) => Promise<void>);
  router.get("/users/:id", authMiddleware, controller.getById as (req: Request, res: Response) => Promise<void>);
  return router;
}
