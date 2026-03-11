# Identity Service

Microserviço de **identidade**: usuários, autenticação (email/senha e OAuth Google/GitHub), JWT e publicação do evento `user.created`.

## Structure (summary)

- **domain/** — `User`, value objects (e.g. Email), domain types (e.g. OAuthProvider). No I/O interfaces.
- **application/** — Use cases (register, login, get-current-user, oauth-callback, create-user, get-user-by-id), **all ports** (repositories, hasher, token, cache, event publisher, OAuth provider), DTOs (register, login, create-user, auth-response, oauth-callback-query).
- **adapters/** — **Driving:** HTTP (auth, user controllers, validation, routes), **Driven:** persistence (Prisma), messaging (RabbitMQ publisher), notifiers, auth (JWT, Argon2, Google/GitHub OAuth).

Composition root: `src/container.ts`. Entry: `src/index.ts`.

## Where to find things

| What | Where |
|------|-------|
| Entities and value objects | `src/domain/entities/`, `src/domain/value-objects/` |
| Repository and other ports | `src/application/ports/` |
| Use cases | `src/application/use-cases/` |
| DTOs (input/output, errors) | `src/application/dtos/` |
| Routes and controllers | `src/adapters/driving/http/` (auth.routes, auth.controller, user.controller, routes.ts) |
| Persistence | `src/adapters/driven/persistence/` |
| Composition root | `src/container.ts` |

## Documentação geral

- [ARCHITECTURE](../../../docs/ARCHITECTURE.md) — visão do framework e do shared
- [STRUCTURE](../../../docs/STRUCTURE.md) — árvore e convenções
- [API](../../../docs/API.md) — endpoints e autenticação
- [DEVELOPMENT](../../../docs/DEVELOPMENT.md) — rodar, testar, troubleshooting
- [SECURITY](../../../docs/SECURITY.md) — validação e segurança
