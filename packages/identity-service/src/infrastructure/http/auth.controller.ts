import { Request, Response } from "express";
import type { AuthenticatedRequest } from "./auth.middleware";
import type { RegisterUseCase } from "../../application/use-cases/register.use-case";
import type { LoginUseCase } from "../../application/use-cases/login.use-case";
import type { GetCurrentUserUseCase } from "../../application/use-cases/get-current-user.use-case";
import type { OAuthCallbackUseCase } from "../../application/use-cases/oauth-callback.use-case";
import type { IOAuthProvider } from "../../application/ports/oauth-provider.port";
import type { ICacheService } from "../../application/ports/cache.port";
import type { RegisterDto } from "../../application/dtos/register.dto";
import type { LoginDto } from "../../application/dtos/login.dto";
import type { AuthResponseDto } from "../../application/dtos/auth-response.dto";
import type { OAuthCallbackResponseDto } from "../../application/dtos/oauth-callback-response.dto";
import {
  oauthCallbackQuerySchema,
  type OAuthCallbackQueryDto,
} from "../../application/dtos/oauth-callback-query.dto";
import { formatExpiresIn } from "./utils/format-expires-in";
import { performOAuthRedirect, OAUTH_STATE_PREFIX } from "./utils/oauth-redirect";
import { sendError } from "./utils/send-error";
import {
  UserAlreadyExistsError,
  InvalidCredentialsError,
  InvalidEmailError,
  PasswordValidationError,
} from "../../application/errors";

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
      const dto: RegisterDto = req.body;
      const result = await this.registerUseCase.execute(dto);
      const body: AuthResponseDto = {
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: formatExpiresIn(this.jwtExpiresInSeconds),
      };
      res.status(201).json(body);
    } catch (err) {
      if (err instanceof UserAlreadyExistsError) {
        sendError(res, 409, err.message);
        return;
      }
      if (err instanceof InvalidEmailError || err instanceof PasswordValidationError) {
        sendError(res, 400, err.message);
        return;
      }
      sendError(res, 500, "Internal server error");
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: LoginDto = req.body;
      const result = await this.loginUseCase.execute(dto);
      const body: AuthResponseDto = {
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: formatExpiresIn(this.jwtExpiresInSeconds),
      };
      res.json(body);
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        sendError(res, 401, err.message);
        return;
      }
      sendError(res, 500, "Internal server error");
    }
  };

  me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = await this.getCurrentUserUseCase.execute(req.userId);
      if (!user) {
        sendError(res, 404, "User not found");
        return;
      }
      res.json(user);
    } catch {
      sendError(res, 500, "Internal server error");
    }
  };

  googleRedirect = async (req: Request, res: Response): Promise<void> => {
    if (!this.googleProvider) {
      sendError(res, 503, "Google OAuth is not configured");
      return;
    }
    await performOAuthRedirect(this.googleProvider, "google", res, this.cache, this.baseUrl);
  };

  googleCallback = async (req: Request, res: Response): Promise<void> => {
    await this.handleOAuthCallback(req, res, this.googleProvider, "google");
  };

  githubRedirect = async (req: Request, res: Response): Promise<void> => {
    if (!this.githubProvider) {
      sendError(res, 503, "GitHub OAuth is not configured");
      return;
    }
    await performOAuthRedirect(this.githubProvider, "github", res, this.cache, this.baseUrl);
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
      sendError(res, 503, providerName + " OAuth is not configured");
      return;
    }
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    const state = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
    const parsed = oauthCallbackQuerySchema.safeParse({ code, state });
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "Invalid query";
      sendError(res, 400, message);
      return;
    }
    const query: OAuthCallbackQueryDto = parsed.data;
    const stateKey = OAUTH_STATE_PREFIX + query.state;
    const stateValid = await this.cache.get<string>(stateKey);
    if (!stateValid) {
      sendError(res, 400, "Invalid or expired state");
      return;
    }
    await this.cache.delete(stateKey);

    try {
      const redirectUri = this.baseUrl + "/api/auth/" + providerName + "/callback";
      const result = await this.oauthCallbackUseCase.execute(query.code, redirectUri, provider);
      const body: OAuthCallbackResponseDto = {
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: formatExpiresIn(this.jwtExpiresInSeconds),
      };
      res.json(body);
    } catch (err) {
      const safeMessage = err instanceof Error ? err.message : "Unknown error";
      const safeName = err instanceof Error ? err.name : "Error";
      console.error("OAuth callback (" + providerName + ") failed:", safeName, safeMessage);
      sendError(res, 400, "OAuth failed");
    }
  };
}
