import { describe, it, expect, vi, beforeEach } from "vitest";
import { ItemController } from "./item.controller";
import type { CreateItemUseCase } from "../../../application/use-cases/create-item.use-case";
import type { ListItemsUseCase } from "../../../application/use-cases/list-items.use-case";
import type { Response } from "express";
import type { NextFunction } from "express";
import { InvalidItemError } from "../../../application/errors";
import { mapApplicationErrorToHttp } from "./error-to-http.mapper";
import { sendError } from "@lframework/shared";
import { createMockRequest, createMockAuthenticatedRequest } from "@lframework/shared/test";

describe("ItemController", () => {
  let createItemUseCase: CreateItemUseCase;
  let listItemsUseCase: ListItemsUseCase;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    createItemUseCase = {
      execute: vi.fn(),
    };
    listItemsUseCase = {
      execute: vi.fn(),
    };
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
    it("deve retornar 200 com array de itens quando use case retorna lista", async () => {
      const items = [
        {
          id: "id-1",
          name: "Item A",
          priceAmount: 100,
          priceCurrency: "BRL",
          createdAt: "2025-01-01T00:00:00.000Z",
        },
      ];
      vi.mocked(listItemsUseCase.execute).mockResolvedValue(items);

      const controller = new ItemController(
        createItemUseCase as CreateItemUseCase,
        listItemsUseCase as ListItemsUseCase
      );
      await controller.list(createMockRequest(), res as Response, next);

      expect(res.json).toHaveBeenCalledWith(items);
      expect(listItemsUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it("deve retornar array vazio quando não há itens", async () => {
      vi.mocked(listItemsUseCase.execute).mockResolvedValue([]);

      const controller = new ItemController(
        createItemUseCase as CreateItemUseCase,
        listItemsUseCase as ListItemsUseCase
      );
      await controller.list(createMockRequest(), res as Response, next);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it("deve retornar 500 quando use case lança erro", async () => {
      vi.mocked(listItemsUseCase.execute).mockRejectedValue(new Error("DB error"));

      const controller = new ItemController(
        createItemUseCase as CreateItemUseCase,
        listItemsUseCase as ListItemsUseCase
      );
      await controller.list(createMockRequest(), res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("create", () => {
    it("deve retornar 201 e o item criado em sucesso", async () => {
      const created = {
        id: "item-1",
        name: "Produto",
        priceAmount: 9999,
        priceCurrency: "BRL",
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      vi.mocked(createItemUseCase.execute).mockResolvedValue(created);

      const controller = new ItemController(
        createItemUseCase as CreateItemUseCase,
        listItemsUseCase as ListItemsUseCase
      );
      const req = createMockAuthenticatedRequest({ body: { name: "Produto", priceAmount: 9999, priceCurrency: "BRL" }, userId: "user-1" });
      await controller.create(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
      expect(createItemUseCase.execute).toHaveBeenCalledWith({
        name: "Produto",
        priceAmount: 9999,
        priceCurrency: "BRL",
      });
    });

    it("deve retornar 400 quando InvalidItemError", async () => {
      vi.mocked(createItemUseCase.execute).mockRejectedValue(
        new InvalidItemError("Price must be non-negative")
      );

      const controller = new ItemController(
        createItemUseCase as CreateItemUseCase,
        listItemsUseCase as ListItemsUseCase
      );
      const req = createMockAuthenticatedRequest({ body: { name: "X", priceAmount: -1, priceCurrency: "BRL" }, userId: "user-1" });
      await controller.create(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Price must be non-negative" });
    });

    it("deve retornar 500 para erro não mapeado", async () => {
      vi.mocked(createItemUseCase.execute).mockRejectedValue(new Error("DB error"));

      const controller = new ItemController(
        createItemUseCase as CreateItemUseCase,
        listItemsUseCase as ListItemsUseCase
      );
      const req = createMockAuthenticatedRequest({ body: { name: "X", priceAmount: 100, priceCurrency: "BRL" }, userId: "user-1" });
      await controller.create(req, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });
});
