# Structure and conventions (Hexagonal Architecture)

This document defines **where everything goes** and **how to name** it. When adding a feature or a new service, you know which folder and file names to use.

---

## 1. Hexagonal layout (one microservice)

Every microservice under `packages/<name>-service/` follows the **same tree**. The structure applies hexagonal architecture correctly:

- **Domain**: core business only (entities, value objects, domain types). No I/O interfaces.
- **Application**: use cases and **all ports** (inbound and outbound). Every interface the application needs from the outside lives in `application/ports/` (including repository ports).
- **Adapters**: concrete implementations. **Driving** adapters call into the application (HTTP, message consumers). **Driven** adapters implement application ports (persistence, messaging, cache, auth, etc.).

```
packages/<service>/src/
├── index.ts                    # Entry: env, container, Express, listen
├── container.ts                # Composition root: wires adapters + use cases + routes
│
├── domain/                     # Core: business rules only, no I/O
│   ├── entities/
│   │   └── <entity>.entity.ts
│   ├── value-objects/
│   │   └── <name>.vo.ts
│   └── types.ts                # Domain types (e.g. OAuthProvider)
│
├── application/
│   ├── ports/                  # All ports (driven + repository contracts)
│   │   ├── <entity>-repository.port.ts
│   │   ├── <entity>-*-persistence.port.ts
│   │   └── <service>.port.ts   # e.g. event-publisher.port.ts, token-service.port.ts
│   ├── use-cases/
│   │   ├── create-<entity>.use-case.ts
│   │   ├── get-<entity>-by-id.use-case.ts
│   │   └── list-<entities>.use-case.ts
│   ├── dtos/
│   │   ├── create-<entity>.dto.ts
│   │   └── <entity>-response.dto.ts
│   └── errors.ts               # Application errors (e.g. UserAlreadyExistsError)
│
└── adapters/
    ├── driving/                # Primary: who calls the service
    │   ├── http/
    │   │   ├── routes.ts
    │   │   ├── <resource>.controller.ts
    │   │   ├── <resource>.validation.ts
    │   │   └── error-to-http.mapper.ts
    │   └── messaging/
    │       └── rabbitmq-*-consumer.ts
    └── driven/                 # Secondary: who the service calls
        ├── persistence/
        │   └── prisma-<entity>.repository.ts
        ├── messaging/
        │   └── rabbitmq-*-publisher.adapter.ts
        ├── cache/
        ├── notifiers/
        └── auth/               # OAuth providers, password hashers, token services
```

If a file does not fit any folder above, the structure is wrong or a folder is missing — do not invent a new place without updating this doc.

**Tests:** Colocated next to the source file. For `foo.ts`, the test file is `foo.spec.ts` in the same folder (e.g. `create-user.use-case.ts` + `create-user.use-case.spec.ts`). No `_tests_` or separate test directories.

---

## 2. Naming conventions

| Type | File | Example |
|------|------|---------|
| Entity | `domain/entities/<name>.entity.ts` | `User`, `Item` |
| Value object | `domain/value-objects/<name>.vo.ts` | `Email`, `Money` |
| Repository port | `application/ports/<entity>-repository.port.ts` | `IUserRepository`, `IItemRepository` |
| Other port | `application/ports/<name>.port.ts` | `IEventPublisher`, `ITokenService`, `IOAuthProvider` |
| Use case | `application/use-cases/<action>-<entity>.use-case.ts` | `CreateUserUseCase`, `GetUserByIdUseCase` |
| DTO | `application/dtos/create-<entity>.dto.ts`, `<entity>-response.dto.ts` | `CreateItemDto`, `ItemResponseDto` |
| Controller | `adapters/driving/http/<resource>.controller.ts` | `UserController`, `ItemController` |
| Validation | `adapters/driving/http/<resource>.validation.ts` | `createValidateBody(createUserSchema)` (shared) |
| Repository (impl.) | `adapters/driven/persistence/prisma-<entity>.repository.ts` | `PrismaUserRepository` |

---

## 3. Checklist: new resource (entity) in the service

Example: add **Order** to catalog-service.

1. **Domain**
   - [ ] `domain/entities/order.entity.ts`
   - [ ] Value objects in `domain/value-objects/` if needed
   - [ ] Domain types in `domain/types.ts` if needed

2. **Application**
   - [ ] `application/ports/order-repository.port.ts` (and any other ports)
   - [ ] `application/dtos/create-order.dto.ts` and `order-response.dto.ts`
   - [ ] Use cases in `application/use-cases/` (e.g. `create-order.use-case.ts`, `get-order-by-id.use-case.ts`)
   - [ ] Application errors in `application/errors.ts` if needed

3. **Adapters**
   - [ ] `adapters/driven/persistence/prisma-order.repository.ts`
   - [ ] Prisma migration and `prisma migrate dev`
   - [ ] `adapters/driving/http/order.controller.ts`
   - [ ] `adapters/driving/http/order.validation.ts`
   - [ ] Update `adapters/driving/http/error-to-http.mapper.ts` for new errors
   - [ ] In `routes.ts`: add `createOrderRoutes(controller)` and register routes
   - [ ] In `container.ts`: register repository, use cases, controller, routes

---

## 4. Checklist: new microservice

1. Copy an existing service folder (e.g. `identity-service`) and rename to `packages/<new>-service/`.
2. Replace entity/resource names; keep the **same tree** as in this document.
3. Update `package.json` (package name, scripts).
4. Update `prisma/schema.prisma` (models for the new context).
5. In `container.ts`: same pattern (config → Prisma, Redis, repositories, use cases, controllers, routes).
6. In `index.ts`: load env, `createContainer(config)`, connect messaging if needed, mount Express with `/api` and `/health`, listen, SIGTERM → disconnect.
7. If publishing or consuming events: use types and constants from `@lframework/shared` (payloads, exchanges, queues).
8. Use `sendError`, `sendValidationError`, and shared schemas (e.g. `nameSchema`) from shared where appropriate.

---

## 5. What lives in `packages/shared`

- **Events:** payload types, event names, RabbitMQ constants.
- **Contracts and helpers:** `ErrorResponseDto`, `sendError`, `sendValidationError`, `nameSchema` (and other common schemas).
- **Cache:** port `ICacheService`, Redis adapter (if all services use the same one).

**Do not put in shared:** business rules of a single service, service-specific API DTOs, per-app bootstrap. That keeps shared from becoming a bag of exceptions.

---

## 6. Summary

- **One service = one fixed tree.** New features = new files in the same folders, following the naming conventions.
- **New service = copy tree and rename.** No new structure.
- **Shared = framework core.** Events, error DTOs, HTTP helpers, common schemas; the rest stays in the service.
- **Hexagonal rule:** Domain has no ports; application defines all ports; adapters (driving/driven) implement or call them.
