# Identity Service – Architecture

## Layers

- **Domain** (`src/domain/`): Entities (e.g. `User`), value objects (e.g. `Email`), and repository/persistence interfaces. No framework or I/O here.
- **Application** (`src/application/`): Use cases (orchestrate domain + ports), DTOs, ports (interfaces for hashing, tokens, events, cache, OAuth), and application errors.
- **Infrastructure** (`src/infrastructure/`): Adapters that implement the ports — HTTP (Express routes, controllers, middleware), persistence (Prisma repositories), auth (JWT, Argon2, OAuth providers), messaging (RabbitMQ).

## Request flow

1. **HTTP** → Express route (e.g. `POST /api/auth/register`) with optional middleware (auth, validation, rate limit).
2. **Controller** → Maps request/body to DTOs and calls the appropriate use case; returns HTTP status and JSON.
3. **Use case** → Contains the business logic; uses **ports** (interfaces) for persistence, hashing, tokens, events, cache.
4. **Ports / Adapters** → Use cases depend only on interfaces; concrete implementations (Prisma, Redis, RabbitMQ, JWT, etc.) are injected via the container.

## Where to find things

| What | Where |
|------|--------|
| Entities & value objects | `src/domain/entities/`, `src/domain/value-objects/` |
| Repository / persistence interfaces | `src/domain/repository-interfaces/` |
| Use cases | `src/application/use-cases/` |
| Ports (hasher, token, event, cache, OAuth) | `src/application/ports/` |
| DTOs & validation | `src/application/dtos/`, `src/infrastructure/http/auth.validation.ts` |
| Routes & controllers | `src/infrastructure/http/routes.ts`, `auth.routes.ts`, `user.controller.ts`, `auth.controller.ts` |
| Persistence adapters (Prisma) | `src/infrastructure/persistence/*.repository.ts` |
| Dependency wiring | `src/container.ts` |

Entry point: `src/index.ts` (Express app + `createContainer`).
