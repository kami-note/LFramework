import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "./auth.controller";
import { createAuthMiddleware } from "./auth.middleware";
import { validateRegister, validateLogin } from "./auth.validation";
import type { ITokenService } from "../../application/ports/token-service.port";

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
  tokenService: ITokenService
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(tokenService);

  router.post("/auth/register", authRateLimiter, validateRegister, controller.register);
  router.post("/auth/login", authRateLimiter, validateLogin, controller.login);
  router.get("/auth/me", authMiddleware, controller.me);

  router.get("/auth/google", oauthRateLimiter, controller.googleRedirect);
  router.get("/auth/google/callback", oauthRateLimiter, controller.googleCallback);

  router.get("/auth/github", oauthRateLimiter, controller.githubRedirect);
  router.get("/auth/github/callback", oauthRateLimiter, controller.githubCallback);

  return router;
}
