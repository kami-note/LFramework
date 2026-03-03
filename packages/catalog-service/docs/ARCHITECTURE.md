# Catalog Service – Architecture

## Layers

- **Domain** (`src/domain/`): Entities (e.g. `Item`), value objects (e.g. `Money`), and repository/persistence interfaces. No framework or I/O here.
- **Application** (`src/application/`): Use cases (orchestrate domain + ports), DTOs, ports (interfaces for cache, events), and application errors.
- **Infrastructure** (`src/infrastructure/`): Adapters that implement the ports — HTTP (Express routes, controllers, middleware), persistence (Prisma repositories), messaging (RabbitMQ).

## Request flow

1. **HTTP** → Express route (e.g. `POST /api/items`) with optional middleware (validation).
2. **Controller** → Maps request/body to DTOs and calls the appropriate use case; returns HTTP status and JSON.
3. **Use case** → Contains the business logic; uses **ports** (interfaces) for persistence and cache.
4. **Ports / Adapters** → Use cases depend only on interfaces; concrete implementations (Prisma, Redis, RabbitMQ) are injected via the container.

## Where to find things

| What | Where |
|------|--------|
| Entities & value objects | `src/domain/entities/`, `src/domain/value-objects/` |
| Repository / persistence interfaces | `src/domain/repository-interfaces/` |
| Use cases | `src/application/use-cases/` |
| Ports (cache, event consumer) | `src/application/ports/` |
| DTOs & validation | DTOs (schemas Zod como fonte única; tipos inferidos) em `src/application/dtos/`; middlewares de validação em `src/infrastructure/http/*.validation.ts` importam os schemas dos DTOs. Se surgirem mais DTOs com campos em comum (ex.: preço), considerar um `catalog-common.schema.ts`. |
| Routes & controllers | `src/infrastructure/http/routes.ts`, `item.controller.ts` |
| Persistence adapters (Prisma) | `src/infrastructure/persistence/*.repository.ts` |
| Dependency wiring | `src/container.ts` |

Entry point: `src/index.ts` (Express app + `createContainer`).
