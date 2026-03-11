import { describe, it, expect, vi, beforeEach } from "vitest";
import { Response } from "express";
import { NextFunction } from "express";
import { AuthController } from "./auth.controller";
import type { RegisterUseCase } from "../../../application/use-cases/register.use-case";
import type { LoginUseCase } from "../../../application/use-cases/login.use-case";
import type { GetCurrentUserUseCase } from "../../../application/use-cases/get-current-user.use-case";
import type { OAuthCallbackUseCase } from "../../../application/use-cases/oauth-callback.use-case";
import type { IOAuthProvider } from "../../../application/ports/oauth-provider.port";
import type { ICacheService } from "@lframework/shared";
import {
  UserAlreadyExistsError,
  InvalidCredentialsError,
  InvalidEmailError,
  PasswordValidationError,
} from "../../../application/errors";
import { mapApplicationErrorToHttp } from "./error-to-http.mapper";
import { sendError } from "@lframework/shared";
import { createMockRequest, createMockResponse, createMockAuthenticatedRequest } from "@lframework/shared/test";

describe("AuthController", () => {
  let registerUseCase: RegisterUseCase;
  let loginUseCase: LoginUseCase;
  let getCurrentUserUseCase: GetCurrentUserUseCase;
  let oauthCallbackUseCase: OAuthCallbackUseCase;
  let googleProvider: IOAuthProvider | null;
  let githubProvider: IOAuthProvider | null;
  let cache: ICacheService;
  let res: Response;
  let next: NextFunction;

  const baseUrl = "https://api.example.com";
  const jwtExpiresInSeconds = 3600;

  const mockUser = {
    id: "user-1",
    email: "u@example.com",
    name: "User",
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  const mockAuthResult = {
    user: mockUser,
    accessToken: "token-123",
  };

  beforeEach(() => {
    registerUseCase = { execute: vi.fn() } as unknown as RegisterUseCase;
    loginUseCase = { execute: vi.fn() } as unknown as LoginUseCase;
    getCurrentUserUseCase = { execute: vi.fn() } as unknown as GetCurrentUserUseCase;
    oauthCallbackUseCase = { execute: vi.fn() } as unknown as OAuthCallbackUseCase;
    googleProvider = null;
    githubProvider = null;
    cache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    } as unknown as ICacheService;
    res = createMockResponse();
    next = ((err: unknown) => {
      const { statusCode, message } = mapApplicationErrorToHttp(err);
      sendError(res, statusCode, message);
    }) as NextFunction;
  });

  function createController(): AuthController {
    return new AuthController(
      registerUseCase,
      loginUseCase,
      getCurrentUserUseCase,
      oauthCallbackUseCase,
      googleProvider,
      githubProvider,
      baseUrl,
      cache,
      jwtExpiresInSeconds
    );
  }

  describe("register", () => {
    it("deve retornar 201 e body com user, accessToken e expiresIn em sucesso", async () => {
      vi.mocked(registerUseCase.execute).mockResolvedValue(mockAuthResult);
      const controller = createController();
      const req = createMockRequest({ body: { email: "u@example.com", name: "User", password: "Pass123!" } });

      await controller.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        user: mockUser,
        accessToken: "token-123",
        expiresIn: "1h",
      });
    });

    it("deve retornar 409 quando UserAlreadyExistsError", async () => {
      vi.mocked(registerUseCase.execute).mockRejectedValue(
        new UserAlreadyExistsError("User with this email already exists")
      );
      const controller = createController();
      const req = createMockRequest({ body: { email: "exist@example.com", name: "X", password: "Pass123!" } });

      await controller.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "User with this email already exists" });
    });

    it("deve repassar erro para next (validation/400) quando InvalidEmailError", async () => {
      vi.mocked(registerUseCase.execute).mockRejectedValue(new InvalidEmailError("Invalid email"));
      const controller = createController();
      const req = createMockRequest({ body: { email: "invalid", name: "X", password: "Pass123!" } });

      await controller.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid email" });
    });

    it("deve repassar erro para next (validation/400) quando PasswordValidationError", async () => {
      vi.mocked(registerUseCase.execute).mockRejectedValue(
        new PasswordValidationError("Password too short")
      );
      const controller = createController();
      const req = createMockRequest({ body: { email: "u@example.com", name: "X", password: "1" } });

      await controller.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Password too short" });
    });
  });

  describe("login", () => {
    it("deve retornar 200 e body com user, accessToken e expiresIn em sucesso", async () => {
      vi.mocked(loginUseCase.execute).mockResolvedValue(mockAuthResult);
      const controller = createController();
      const req = createMockRequest({ body: { email: "u@example.com", password: "Pass123!" } });

      await controller.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        user: mockUser,
        accessToken: "token-123",
        expiresIn: "1h",
      });
    });

    it("deve retornar 401 quando InvalidCredentialsError", async () => {
      vi.mocked(loginUseCase.execute).mockRejectedValue(
        new InvalidCredentialsError("Invalid email or password")
      );
      const controller = createController();
      const req = createMockRequest({ body: { email: "u@example.com", password: "wrong" } });

      await controller.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid email or password" });
    });

    it("deve retornar 400 quando InvalidEmailError (validação)", async () => {
      vi.mocked(loginUseCase.execute).mockRejectedValue(new InvalidEmailError("Invalid email"));
      const controller = createController();
      const req = createMockRequest({ body: { email: "bad", password: "x" } });

      await controller.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid email" });
    });
  });

  describe("me", () => {
    it("deve retornar 200 com user quando usuário existe", async () => {
      vi.mocked(getCurrentUserUseCase.execute).mockResolvedValue(mockUser);
      const controller = createController();
      const req = createMockAuthenticatedRequest({ userId: "user-1" });

      await controller.me(req, res, next);

      expect(res.json).toHaveBeenCalledWith(mockUser);
      expect(getCurrentUserUseCase.execute).toHaveBeenCalledWith("user-1");
    });

    it("deve retornar 404 quando usuário não encontrado", async () => {
      vi.mocked(getCurrentUserUseCase.execute).mockResolvedValue(null);
      const controller = createController();
      const req = createMockAuthenticatedRequest({ userId: "user-1" });

      await controller.me(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
    });
  });

  describe("googleRedirect", () => {
    it("deve retornar 503 quando Google OAuth não está configurado", async () => {
      const controller = createController();
      const req = createMockRequest();

      await controller.googleRedirect(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ error: "Google OAuth is not configured" });
    });

    it("deve redirecionar quando provider está configurado", async () => {
      const redirectUrl = "https://accounts.google.com/authorize?...";
      const redirectFn = vi.fn();
      const resWithRedirect = { ...res, redirect: redirectFn } as Response;
      const mockProvider: IOAuthProvider = {
        getAuthorizationUrl: vi.fn().mockReturnValue(redirectUrl),
        getAccessToken: vi.fn(),
        getProfile: vi.fn(),
      };
      const controller = new AuthController(
        registerUseCase,
        loginUseCase,
        getCurrentUserUseCase,
        oauthCallbackUseCase,
        mockProvider,
        githubProvider,
        baseUrl,
        cache,
        jwtExpiresInSeconds
      );
      vi.mocked(cache.set).mockResolvedValue(undefined);
      const req = createMockRequest();

      await controller.googleRedirect(req, resWithRedirect);

      expect(mockProvider.getAuthorizationUrl).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
      expect(redirectFn).toHaveBeenCalledWith(redirectUrl);
    });
  });

  describe("githubRedirect", () => {
    it("deve retornar 503 quando GitHub OAuth não está configurado", async () => {
      const controller = createController();
      const req = createMockRequest();

      await controller.githubRedirect(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ error: "GitHub OAuth is not configured" });
    });
  });

  describe("OAuth callback (googleCallback / handleOAuthCallback)", () => {
    const validCode = "auth-code-123";
    const validState = "state-xyz";

    it("deve retornar 503 quando provider não está configurado", async () => {
      const controller = createController();
      const req = createMockRequest({ query: { code: validCode, state: validState } });

      await controller.googleCallback(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ error: "google OAuth is not configured" });
    });

    it("deve retornar 400 (validação) quando query inválida (state/code faltando)", async () => {
      const mockProvider: IOAuthProvider = {
        getAuthorizationUrl: vi.fn(),
        getAccessToken: vi.fn(),
        getProfile: vi.fn(),
      };
      const controller = new AuthController(
        registerUseCase,
        loginUseCase,
        getCurrentUserUseCase,
        oauthCallbackUseCase,
        mockProvider,
        githubProvider,
        baseUrl,
        cache,
        jwtExpiresInSeconds
      );
      const req = createMockRequest({ query: {} });

      await controller.googleCallback(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    it("deve retornar 400 com mensagem 'Invalid or expired state' quando state não está no cache", async () => {
      vi.mocked(cache.get).mockResolvedValue(null);
      const mockProvider: IOAuthProvider = {
        getAuthorizationUrl: vi.fn(),
        getAccessToken: vi.fn(),
        getProfile: vi.fn(),
      };
      const controller = new AuthController(
        registerUseCase,
        loginUseCase,
        getCurrentUserUseCase,
        oauthCallbackUseCase,
        mockProvider,
        githubProvider,
        baseUrl,
        cache,
        jwtExpiresInSeconds
      );
      const req = createMockRequest({ query: { code: validCode, state: validState } });

      await controller.googleCallback(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired state" });
      expect(oauthCallbackUseCase.execute).not.toHaveBeenCalled();
    });

    it("deve retornar 200 com user e tokens quando state válido e callback sucesso", async () => {
      vi.mocked(cache.get).mockResolvedValue("1");
      vi.mocked(cache.delete).mockResolvedValue(undefined);
      vi.mocked(oauthCallbackUseCase.execute).mockResolvedValue({
        user: { ...mockUser, isNewUser: false, createdAt: mockUser.createdAt! },
        accessToken: "oauth-token",
      });
      const mockProvider: IOAuthProvider = {
        getAuthorizationUrl: vi.fn(),
        getAccessToken: vi.fn(),
        getProfile: vi.fn(),
      };
      const controller = new AuthController(
        registerUseCase,
        loginUseCase,
        getCurrentUserUseCase,
        oauthCallbackUseCase,
        mockProvider,
        githubProvider,
        baseUrl,
        cache,
        jwtExpiresInSeconds
      );
      const req = createMockRequest({ query: { code: validCode, state: validState } });

      await controller.googleCallback(req, res, next);

      expect(cache.get).toHaveBeenCalledWith("oauth_state:state-xyz");
      expect(cache.delete).toHaveBeenCalledWith("oauth_state:state-xyz");
      expect(oauthCallbackUseCase.execute).toHaveBeenCalledWith(
        validCode,
        "https://api.example.com/api/auth/google/callback",
        mockProvider
      );
      expect(res.json).toHaveBeenCalledWith({
        user: expect.objectContaining({ id: mockUser.id, email: mockUser.email, name: mockUser.name }),
        accessToken: "oauth-token",
        expiresIn: "1h",
      });
    });
  });
});
