import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserController } from "./user.controller";
import type { CreateUserUseCase } from "../../../application/use-cases/create-user.use-case";
import type { GetUserByIdUseCase } from "../../../application/use-cases/get-user-by-id.use-case";
import type { Response } from "express";
import type { NextFunction } from "express";
import { mapApplicationErrorToHttp } from "./error-to-http.mapper";
import { sendError } from "@lframework/shared";

describe("UserController — cenários absurdos", () => {
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

  describe("getById", () => {
    it("não explode quando req.params.id é undefined", async () => {
      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = {
        params: { id: undefined },
        userId: "11111111-1111-1111-1111-111111111111",
        userRole: "user",
      } as any;
      await controller.getById(req, res as Response, next);
      // Deve responder 400 (uuid inválido) em vez de quebrar
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid user id format" });
    });

    it("não explode quando req.params é {} (id inexistente)", async () => {
      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = {
        params: {},
        userId: "11111111-1111-1111-1111-111111111111",
        userRole: "user",
      } as any;
      await controller.getById(req, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("não explode quando id parece UUID mas com lixo no final", async () => {
      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = {
        params: { id: "11111111-1111-1111-1111-111111111111; DROP TABLE users;" },
        userId: "11111111-1111-1111-1111-111111111111",
        userRole: "user",
      } as any;
      await controller.getById(req, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(getUserByIdUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("não explode quando body é undefined", async () => {
      vi.mocked(createUserUseCase.execute).mockRejectedValue(new Error("body undefined"));
      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { body: undefined, userId: "admin-1", userRole: "admin" } as any;
      await controller.create(req, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("não explode quando body é null", async () => {
      vi.mocked(createUserUseCase.execute).mockRejectedValue(new Error("null"));
      const controller = new UserController(createUserUseCase, getUserByIdUseCase);
      const req = { body: null, userId: "admin-1", userRole: "admin" } as any;
      await controller.create(req, res as Response, next);
      expect(createUserUseCase.execute).toHaveBeenCalled();
    });
  });
});
