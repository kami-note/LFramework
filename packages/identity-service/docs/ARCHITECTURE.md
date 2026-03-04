# Identity Service – Architecture

## Layers

- **Domain** (`src/domain/`): Entities (e.g. `User`), value objects (e.g. `Email`), repository/persistence interfaces, and canonical domain types (`domain/types.ts`). No framework or I/O here.
- **Application** (`src/application/`): Use cases (orchestrate domain + ports), DTOs, ports (interfaces for hashing, tokens, events, cache, OAuth), and application errors.
- **Infrastructure** (`src/infrastructure/`): Adapters that implement the ports — HTTP (Express routes, controllers, middleware), persistence (Prisma repositories), auth (JWT, Argon2, OAuth providers), messaging (RabbitMQ).

## Composition root

O **composition root** fica em `src/container.ts`: é o único ponto onde as dependências são montadas (repositórios, use cases, controllers, adapters). Nada mais instancia implementações concretas de portas; o container injeta tudo.

## Shared

O pacote `@lframework/shared` contém: porta de cache (`ICacheService`), adapter Redis, eventos (`USER_CREATED_EVENT`, `UserCreatedPayload`), constantes RabbitMQ e DTOs comuns (ex.: `ErrorResponseDto`). A application pode depender de shared para **portas e contratos**; em cada serviço, a porta de cache é reexportada em `application/ports/cache.port.ts` para que a application dependa da porta local e não diretamente do shared. Nenhum serviço importa outro (identity não importa catalog e vice-versa).

## Request flow

1. **HTTP** → Express route (e.g. `POST /api/auth/register`) with optional middleware (auth, validation, rate limit).
2. **Controller** → Maps request/body to DTOs and calls the appropriate use case; returns HTTP status and JSON.
3. **Use case** → Contains the business logic; uses **ports** (interfaces) for persistence, hashing, tokens, events, cache.
4. **Ports / Adapters** → Use cases depend only on interfaces; concrete implementations (Prisma, Redis, RabbitMQ, JWT, etc.) are injected via the container.

## DTOs

- **DTOs de entrada/saída e erros** (ex.: `CreateUserDto`, `ErrorResponseDto`, `AuthResponseDto`, `RegisterDto`) ficam em `src/application/dtos/`.
- **DTOs puramente HTTP** (ex.: health) ficam em `src/infrastructure/http/dtos/` (ex.: `health-response.dto.ts`).
- Convenção: **ResultDto** = retorno de use case; **ResponseDto** = contrato de resposta HTTP.

## Where to find things

| What | Where |
|------|--------|
| Entities & value objects | `src/domain/entities/`, `src/domain/value-objects/` |
| Domain types (canonical) | `src/domain/types.ts` (ex.: `OAuthProvider`) |
| Repository / persistence interfaces | `src/domain/repository-interfaces/` |
| Use cases | `src/application/use-cases/` |
| Ports (cache, hasher, token, event, OAuth) | `src/application/ports/` (cache reexporta `ICacheService` de shared) |
| DTOs (entrada/saída, erros) | `src/application/dtos/` |
| DTOs HTTP (ex.: health) | `src/infrastructure/http/dtos/` |
| Routes & controllers | `src/infrastructure/http/routes.ts`, `auth.routes.ts`, `user.controller.ts`, `auth.controller.ts` |
| Persistence adapters (Prisma) | `src/infrastructure/persistence/*.repository.ts` |
| Composition root / dependency wiring | `src/container.ts` |

Entry point: `src/index.ts` (Express app + `createContainer`).
