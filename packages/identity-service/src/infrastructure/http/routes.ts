import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, requireRole } from "@lframework/shared";
import { UserController } from "./user.controller";
import { validateCreateUser } from "./user.validation";

export function createUserRoutes(
  controller: UserController,
  authMiddleware: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();
  router.post("/users", validateCreateUser, authMiddleware, requireRole("admin"), asyncHandler(controller.create.bind(controller)));
  router.get("/users/:id", authMiddleware, asyncHandler(controller.getById.bind(controller)));
  return router;
}
