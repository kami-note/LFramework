import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserController } from "./user.controller";
import type { CreateUserUseCase } from "../../../application/use-cases/create-user.use-case";
import type { GetUserByIdUseCase } from "../../../application/use-cases/get-user-by-id.use-case";
import type { Response } from "express";
import type { NextFunction } from "express";
import {
  UserAlreadyExistsError,
  InvalidEmailError,
} from "../../../application/errors";
import { mapApplicationErrorToHttp } from "./error-to-http.mapper";
import { sendError } from "@lframework/shared";

describe("UserController", () => {
  let createUserUseCase: CreateUserUseCase;
  let getUserByIdUseCase: GetUserByIdUseCase;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    createUserUseCase = { execute: vi.fn() } as unknown as CreateUserUseCase;
    getUserByIdUseCase = { execute: vi.fn() } as unknown as GetUserByIdUseCase;
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = ((err: unknown) => {
      const { statusCode, message } = mapApplicationErrorToHttp(err);
      sendError(res as Response, statusCode, message);
    }) as NextFunction;
  });

  describe("create", () => {
    it("deve retornar 201 e o usuário criado em sucesso", async () => {
      const created = {
        id: "id-1",
        email: "u@example.com",
        name: "Nome",
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      vi.mocked(createUserUseCase.execute).mockResolvedValue(created);

      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { body: { email: "u@example.com", name: "Nome" }, userId: "admin-1", userRole: "admin" } as any;
      await controller.create(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it("deve retornar 409 quando UserAlreadyExistsError", async () => {
      vi.mocked(createUserUseCase.execute).mockRejectedValue(
        new UserAlreadyExistsError("User with this email already exists")
      );

      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { body: { email: "existente@example.com", name: "X" }, userId: "a", userRole: "admin" } as any;
      await controller.create(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: "User with this email already exists" });
    });

    it("deve retornar 400 quando InvalidEmailError", async () => {
      vi.mocked(createUserUseCase.execute).mockRejectedValue(new InvalidEmailError("Invalid email"));

      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { body: { email: "invalido", name: "X" }, userId: "a", userRole: "admin" } as any;
      await controller.create(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid email" });
    });

    it("deve retornar 500 para erro não mapeado", async () => {
      vi.mocked(createUserUseCase.execute).mockRejectedValue(new Error("DB error"));

      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { body: { email: "u@example.com", name: "X" }, userId: "a", userRole: "admin" } as any;
      await controller.create(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("getById", () => {
    const uuidOwner = "11111111-1111-1111-1111-111111111111";
    const uuidOther = "22222222-2222-2222-2222-222222222222";
    const uuidAdmin = "33333333-3333-3333-3333-333333333333";

    it("deve retornar usuário quando encontrado e requester é o dono", async () => {
      const user = {
        id: uuidOwner,
        email: "u@example.com",
        name: "Nome",
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      vi.mocked(getUserByIdUseCase.execute).mockResolvedValue(user);

      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { params: { id: uuidOwner }, userId: uuidOwner, userRole: "user" } as any;
      await controller.getById(req, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(user);
      expect(getUserByIdUseCase.execute).toHaveBeenCalledWith(uuidOwner);
    });

    it("deve retornar 400 quando id não é UUID", async () => {
      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { params: { id: "nao-uuid" }, userId: uuidOwner, userRole: "user" } as any;
      await controller.getById(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid user id format" });
      expect(getUserByIdUseCase.execute).not.toHaveBeenCalled();
    });

    it("deve retornar 403 quando requester não é o dono nem admin", async () => {
      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { params: { id: uuidOther }, userId: uuidOwner, userRole: "user" } as any;
      await controller.getById(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
      expect(getUserByIdUseCase.execute).not.toHaveBeenCalled();
    });

    it("deve permitir admin acessar qualquer usuário", async () => {
      const user = { id: uuidOther, email: "x@y.com", name: "X", createdAt: "2025-01-01T00:00:00.000Z" };
      vi.mocked(getUserByIdUseCase.execute).mockResolvedValue(user);

      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { params: { id: uuidOther }, userId: uuidAdmin, userRole: "admin" } as any;
      await controller.getById(req, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(user);
      expect(getUserByIdUseCase.execute).toHaveBeenCalledWith(uuidOther);
    });

    it("deve retornar 404 quando usuário não existe", async () => {
      vi.mocked(getUserByIdUseCase.execute).mockResolvedValue(null);

      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { params: { id: uuidOwner }, userId: uuidOwner, userRole: "user" } as any;
      await controller.getById(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
    });

    it("deve retornar 500 quando use case lança", async () => {
      vi.mocked(getUserByIdUseCase.execute).mockRejectedValue(new Error("DB error"));

      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { params: { id: uuidOwner }, userId: uuidOwner, userRole: "user" } as any;
      await controller.getById(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });
});
