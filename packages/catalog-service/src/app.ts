import express, { type Express, type Router } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { createCatalogOpenApi } from "./openapi";
import {
  requestIdMiddleware,
  createErrorHandlerMiddleware,
  createHealthHandler,
} from "@lframework/shared";
import type { HttpErrorMapping } from "@lframework/shared";

export interface CatalogAppContainer {
  itemRoutes: Router;
  mapApplicationErrorToHttp: (error: unknown) => { statusCode: number; message: string } | null;
}

export interface CreateAppOptions {
  /** When set, enables CORS with the given origin(s). */
  corsOrigin?: string;
  /** When set, enables API docs and OpenAPI spec at /api-docs and /api-docs.json. */
  baseUrl?: string;
}

/**
 * Builds the Express application without listening.
 * Used by the server entry point and by integration tests (supertest).
 */
export function createApp(
  container: CatalogAppContainer,
  options: CreateAppOptions = {}
): Express {
  const app = express();
  app.use(requestIdMiddleware);

  if (options.corsOrigin) {
    const origins = options.corsOrigin.split(",").map((s) => s.trim()).filter(Boolean);
    const isWildcard = origins.length === 1 && origins[0] === "*";
    if (isWildcard) {
      app.use(cors({ origin: "*" }));
    } else {
      app.use(cors({ origin: origins, credentials: true }));
    }
  }
  app.use(express.json({ limit: "512kb" }));

  if (options.baseUrl) {
    const openApiSpec = createCatalogOpenApi(options.baseUrl);
    app.get("/api-docs.json", (_req, res) => res.json(openApiSpec));
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(openApiSpec, { customSiteTitle: "Catalog Service API" })
    );
  }

  app.use("/api", container.itemRoutes);

  app.get("/health", createHealthHandler("catalog-service"));

  const errorMapper = (err: unknown): HttpErrorMapping =>
    container.mapApplicationErrorToHttp(err) ?? {
      statusCode: 500,
      message: "Internal server error",
    };
  app.use(createErrorHandlerMiddleware(errorMapper));

  return app;
}
