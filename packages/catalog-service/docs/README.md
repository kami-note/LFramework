# Catalog Service

Microserviço de **catálogo**: itens (CRUD), cache Redis e consumo do evento `user.created` (invalidação de cache por usuário).

## Estrutura (resumo)

- **domain/** — `Item`, value objects (ex.: Money), interfaces de repositório.
- **application/** — Use cases (create-item, list-items, handle-user-created), portas (cache, event consumer), DTOs (create-item, item-response).
- **infrastructure/** — Controller (item), validação (item.validation), persistência (Prisma), mensageria (RabbitMQ consumer UserCreated), auth middleware (JWT).

Composition root: `src/container.ts`. Entry: `src/index.ts`.

## Onde achar as coisas

| O quê | Onde |
|------|------|
| Entidades e value objects | `src/domain/entities/`, `src/domain/value-objects/` |
| Interfaces de repositório | `src/domain/repository-interfaces/` |
| Use cases | `src/application/use-cases/` |
| Portas | `src/application/ports/` |
| DTOs | `src/application/dtos/` (create-item, item-response) |
| Rotas e controllers | `src/infrastructure/http/` (routes.ts, item.controller, item.validation) |
| Persistência | `src/infrastructure/persistence/` |
| Consumer UserCreated | `src/infrastructure/messaging/rabbitmq-user-created.consumer.ts` |
| Composition root | `src/container.ts` |

## Documentação geral

- [ARCHITECTURE](../../../docs/ARCHITECTURE.md) — visão do framework e do shared
- [STRUCTURE](../../../docs/STRUCTURE.md) — árvore e convenções
- [API](../../../docs/API.md) — endpoints
- [DEVELOPMENT](../../../docs/DEVELOPMENT.md) — rodar, testar, troubleshooting
- [SECURITY](../../../docs/SECURITY.md) — validação e segurança
