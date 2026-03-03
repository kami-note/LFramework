import { Request, Response } from "express";
import type { RegisterUseCase } from "../../application/use-cases/register.use-case";
import type { LoginUseCase } from "../../application/use-cases/login.use-case";
import type { GetCurrentUserUseCase } from "../../application/use-cases/get-current-user.use-case";
import type { OAuthCallbackUseCase } from "../../application/use-cases/oauth-callback.use-case";
import type { IOAuthProvider } from "../../application/ports/oauth-provider.port";
import type { ICacheService } from "@lframework/shared";
import { randomBytes } from "crypto";

const OAUTH_STATE_TTL_SECONDS = 600; // 10 min
const OAUTH_STATE_PREFIX = "oauth_state:";

function formatExpiresIn(seconds: number): string {
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

function getCodeFromQuery(req: Request): string | null {
  const raw = req.query.code;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return typeof first === "string" ? first : null;
  }
  return typeof raw === "string" ? raw : null;
}

function getStateFromQuery(req: Request): string | null {
  const raw = req.query.state;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return typeof first === "string" ? first : null;
  }
  return typeof raw === "string" ? raw : null;
}

export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly oauthCallbackUseCase: OAuthCallbackUseCase,
    private readonly googleProvider: IOAuthProvider | null,
    private readonly githubProvider: IOAuthProvider | null,
    private readonly baseUrl: string,
    private readonly cache: ICacheService,
    private readonly jwtExpiresInSeconds: number
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, name, password } = req.body;
      const result = await this.registerUseCase.execute({ email, name, password });
      res.status(201).json({
        user: { id: result.id, email: result.email, name: result.name, createdAt: result.createdAt.toISOString() },
        accessToken: result.accessToken,
        expiresIn: formatExpiresIn(this.jwtExpiresInSeconds),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("already exists")) {
        res.status(409).json({ error: message });
        return;
      }
      if (isPrismaP2002(err)) {
        res.status(409).json({ error: "User with this email already exists" });
        return;
      }
      if (message.includes("Invalid email") || message.includes("at least 8")) {
        res.status(400).json({ error: message });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      const result = await this.loginUseCase.execute({ email, password });
      res.json({
        user: { id: result.id, email: result.email, name: result.name },
        accessToken: result.accessToken,
        expiresIn: formatExpiresIn(this.jwtExpiresInSeconds),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Invalid email or password")) {
        res.status(401).json({ error: message });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const user = await this.getCurrentUserUseCase.execute(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json(user);
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  };

  googleRedirect = async (req: Request, res: Response): Promise<void> => {
    if (!this.googleProvider) {
      res.status(503).json({ error: "Google OAuth is not configured" });
      return;
    }
    const state = randomBytes(16).toString("hex");
    await this.cache.set(OAUTH_STATE_PREFIX + state, "1", OAUTH_STATE_TTL_SECONDS);
    const redirectUri = this.baseUrl + "/api/auth/google/callback";
    const url = this.googleProvider.getAuthorizationUrl(redirectUri, state);
    res.redirect(url);
  };

  googleCallback = async (req: Request, res: Response): Promise<void> => {
    await this.handleOAuthCallback(req, res, this.googleProvider, "google");
  };

  githubRedirect = async (req: Request, res: Response): Promise<void> => {
    if (!this.githubProvider) {
      res.status(503).json({ error: "GitHub OAuth is not configured" });
      return;
    }
    const state = randomBytes(16).toString("hex");
    await this.cache.set(OAUTH_STATE_PREFIX + state, "1", OAUTH_STATE_TTL_SECONDS);
    const redirectUri = this.baseUrl + "/api/auth/github/callback";
    const url = this.githubProvider.getAuthorizationUrl(redirectUri, state);
    res.redirect(url);
  };

  githubCallback = async (req: Request, res: Response): Promise<void> => {
    await this.handleOAuthCallback(req, res, this.githubProvider, "github");
  };

  private handleOAuthCallback = async (
    req: Request,
    res: Response,
    provider: IOAuthProvider | null,
    providerName: string
  ): Promise<void> => {
    if (!provider) {
      res.status(503).json({ error: providerName + " OAuth is not configured" });
      return;
    }
    const code = getCodeFromQuery(req);
    const state = getStateFromQuery(req);
    if (!code) {
      res.status(400).json({ error: "Missing or invalid code" });
      return;
    }
    if (!state) {
      res.status(400).json({ error: "Missing state" });
      return;
    }
    const stateKey = OAUTH_STATE_PREFIX + state;
    const stateValid = await this.cache.get<string>(stateKey);
    if (!stateValid) {
      res.status(400).json({ error: "Invalid or expired state" });
      return;
    }
    await this.cache.delete(stateKey);

    try {
      const redirectUri = this.baseUrl + "/api/auth/" + providerName + "/callback";
      const result = await this.oauthCallbackUseCase.execute(code, redirectUri, provider);
      res.json({
        user: {
          id: result.id,
          email: result.email,
          name: result.name,
          createdAt: result.createdAt.toISOString(),
          isNewUser: result.isNewUser,
        },
        accessToken: result.accessToken,
        expiresIn: formatExpiresIn(this.jwtExpiresInSeconds),
      });
    } catch (err) {
      console.error("OAuth callback (" + providerName + ") failed:", err);
      res.status(400).json({ error: "OAuth failed" });
    }
  };
}

function isPrismaP2002(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}
