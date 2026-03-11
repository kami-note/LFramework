import express, { type Express, type Router } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { createIdentityOpenApi } from "./openapi";
import {
  requestIdMiddleware,
  createErrorHandlerMiddleware,
  createHealthHandler,
} from "@lframework/shared";
import type { HttpErrorMapping } from "@lframework/shared";

export interface AppContainer {
  userRoutes: Router;
  authRoutes: Router;
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
  container: AppContainer,
  options: CreateAppOptions = {}
): Express {
  const app = express();
  app.use(requestIdMiddleware);

  if (options.corsOrigin) {
    app.use(
      cors({
        origin: options.corsOrigin.split(",").map((s) => s.trim()),
        credentials: true,
      })
    );
  }
  app.use(express.json({ limit: "512kb" }));

  if (options.baseUrl) {
    const openApiSpec = createIdentityOpenApi(options.baseUrl);
    app.get("/api-docs.json", (_req, res) => res.json(openApiSpec));
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(openApiSpec, { customSiteTitle: "Identity Service API" })
    );
  }

  app.use("/api", container.userRoutes);
  app.use("/api", container.authRoutes);

  app.get("/health", createHealthHandler("identity-service"));

  app.use(
    createErrorHandlerMiddleware(
      container.mapApplicationErrorToHttp as (err: unknown) => HttpErrorMapping
    )
  );

  return app;
}
