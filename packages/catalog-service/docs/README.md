# Catalog Service

Microserviço de **catálogo**: itens (CRUD), cache Redis e consumo do evento `user.created` (invalidação de cache por usuário).

## Structure (summary)

- **domain/** — `Item`, value objects (e.g. Money), domain types. No I/O interfaces.
- **application/** — Use cases (create-item, list-items, handle-user-created), **all ports** (item repository, cache invalidator, event consumer), DTOs (create-item, item-response).
- **adapters/** — **Driving:** HTTP (item controller, validation, routes), messaging (RabbitMQ UserCreated consumer). **Driven:** persistence (Prisma), cache invalidator, auth (JWT from shared).

Composition root: `src/container.ts`. Entry: `src/index.ts`.

## Where to find things

| What | Where |
|------|-------|
| Entities and value objects | `src/domain/entities/`, `src/domain/value-objects/` |
| Repository and other ports | `src/application/ports/` |
| Use cases | `src/application/use-cases/` |
| DTOs | `src/application/dtos/` (create-item, item-response) |
| Routes and controllers | `src/adapters/driving/http/` (routes.ts, item.controller, item.validation) |
| Persistence | `src/adapters/driven/persistence/` |
| UserCreated consumer | `src/adapters/driving/messaging/rabbitmq-user-created.consumer.ts` |
| Composition root | `src/container.ts` |

## Documentação geral

- [ARCHITECTURE](../../../docs/ARCHITECTURE.md) — visão do framework e do shared
- [STRUCTURE](../../../docs/STRUCTURE.md) — árvore e convenções
- [API](../../../docs/API.md) — endpoints
- [DEVELOPMENT](../../../docs/DEVELOPMENT.md) — rodar, testar, troubleshooting
- [SECURITY](../../../docs/SECURITY.md) — validação e segurança
