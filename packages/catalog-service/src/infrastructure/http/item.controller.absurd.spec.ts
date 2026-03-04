import { describe, it, expect, vi, beforeEach } from "vitest";
import { ItemController } from "./item.controller";
import type { CreateItemUseCase } from "../../application/use-cases/create-item.use-case";
import type { ListItemsUseCase } from "../../application/use-cases/list-items.use-case";
import type { Response } from "express";
import type { NextFunction } from "express";
import { mapApplicationErrorToHttp } from "../../application/http/error-to-http.mapper";
import { sendError } from "@lframework/shared";

describe("ItemController — cenários absurdos", () => {
  let createItemUseCase: CreateItemUseCase;
  let listItemsUseCase: ListItemsUseCase;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    createItemUseCase = { execute: vi.fn() } as unknown as CreateItemUseCase;
    listItemsUseCase = { execute: vi.fn() } as unknown as ListItemsUseCase;
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = ((err: unknown) => {
      const { statusCode, message } = mapApplicationErrorToHttp(err);
      sendError(res as Response, statusCode, message);
    }) as NextFunction;
  });

  describe("list", () => {
    it("não explode quando use case retorna null (comportamento inesperado)", async () => {
      vi.mocked(listItemsUseCase.execute).mockResolvedValue(null as any);
      const controller = new ItemController(
        createItemUseCase as CreateItemUseCase,
        listItemsUseCase as ListItemsUseCase
      );
      await controller.list({} as any, res as Response, next);
      expect(res.json).toHaveBeenCalledWith(null);
    });

    it("não explode quando use case lança string em vez de Error", async () => {
      vi.mocked(listItemsUseCase.execute).mockRejectedValue("erro estranho");
      const controller = new ItemController(
        createItemUseCase as CreateItemUseCase,
        listItemsUseCase as ListItemsUseCase
      );
      await controller.list({} as any, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("create", () => {
    it("não explode quando body está vazio (validação Zod na rota rejeita; controller recebe o que vier)", async () => {
      vi.mocked(createItemUseCase.execute).mockRejectedValue(new Error("invalid"));
      const controller = new ItemController(
        createItemUseCase as CreateItemUseCase,
        listItemsUseCase as ListItemsUseCase
      );
      const req = { body: {}, userId: "user-1" } as any;
      await controller.create(req, res as Response, next);
      expect(createItemUseCase.execute).toHaveBeenCalledWith({});
    });

    it("não explode quando use case lança null", async () => {
      vi.mocked(createItemUseCase.execute).mockRejectedValue(null);
      const controller = new ItemController(
        createItemUseCase as CreateItemUseCase,
        listItemsUseCase as ListItemsUseCase
      );
      const req = { body: { name: "X", priceAmount: 1 }, userId: "user-1" } as any;
      await controller.create(req, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
