import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { createItemSchema } from "./application/dtos/create-item.dto";
import { itemResponseDtoSchema } from "./application/dtos/item-response.dto";

extendZodWithOpenApi(z);

const ErrorSchema = z.object({ error: z.string(), message: z.string() }).openapi("Error");
const CreateItemBodySchema = createItemSchema.openapi("CreateItemBody");
const ItemResponseSchema = itemResponseDtoSchema.openapi("ItemResponse");

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: "get",
  path: "/api/items",
  summary: "Listar itens",
  tags: ["Items"],
  description: "Público; não exige autenticação.",
  responses: {
    200: {
      description: "Lista de itens",
      content: {
        "application/json": {
          schema: z.array(ItemResponseSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/items",
  summary: "Criar item",
  tags: ["Items"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateItemBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Item criado",
      content: { "application/json": { schema: ItemResponseSchema } },
    },
    400: { description: "Validação", content: { "application/json": { schema: ErrorSchema } } },
    401: {
      description: "Não autenticado",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

/**
 * Gera a spec OpenAPI 3 a partir dos schemas Zod (fonte única de verdade).
 * serverUrl: base do serviço (ex.: http://localhost:3002 ou http://localhost/catalog quando atrás do nginx).
 */
export function createCatalogOpenApi(serverUrl: string): object {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const doc = generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Catalog Service API",
      version: "1.0.0",
      description: "Listagem e criação de itens do catálogo. POST exige JWT.",
    },
    servers: [{ url: serverUrl }],
  });

  const docObj = doc as { components?: { securitySchemes?: object } };
  if (docObj.components) {
    docObj.components.securitySchemes = {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token obtido no Identity Service (POST /identity/api/auth/login)",
      },
    };
  }
  return doc;
}
