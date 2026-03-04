import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "@lframework/shared";

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
import { AuthController } from "./auth.controller";
import { validateRegister, validateLogin } from "./auth.validation";

/**
 * Logout: não há endpoint de logout no servidor. O logout é feito no cliente
 * descartando o token (remover do storage/localStorage e não enviar mais o
 * header Authorization). Tokens JWT permanecem válidos até o exp; para
 * revogação antecipada seria necessário um mecanismo adicional (ex.: blacklist).
 */

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20, // login + register combined per IP
  message: { error: "Too many attempts, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const oauthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30, // redirects + callbacks per IP
  message: { error: "Too many OAuth attempts, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export function createAuthRoutes(
  controller: AuthController,
  authMiddleware: (req: Request, res: Response, next: NextFunction) => void
): Router {
  const router = Router();

  router.post("/auth/register", authRateLimiter, validateRegister, asyncHandler(controller.register.bind(controller)));
  router.post("/auth/login", authRateLimiter, validateLogin, asyncHandler(controller.login.bind(controller)));
  router.get("/auth/me", authMiddleware, asyncHandler(controller.me.bind(controller) as AsyncRequestHandler));

  router.get("/auth/google", oauthRateLimiter, asyncHandler(controller.googleRedirect.bind(controller)));
  router.get("/auth/google/callback", oauthRateLimiter, asyncHandler(controller.googleCallback.bind(controller)));

  router.get("/auth/github", oauthRateLimiter, asyncHandler(controller.githubRedirect.bind(controller)));
  router.get("/auth/github/callback", oauthRateLimiter, asyncHandler(controller.githubCallback.bind(controller)));

  return router;
}
