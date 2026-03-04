# Identity Service

Microserviço de **identidade**: usuários, autenticação (email/senha e OAuth Google/GitHub), JWT e publicação do evento `user.created`.

## Estrutura (resumo)

- **domain/** — `User`, value objects (ex.: Email), interfaces de repositório e persistência OAuth.
- **application/** — Use cases (register, login, get-current-user, oauth-callback, create-user, get-user-by-id), portas (hasher, token, cache, event publisher, OAuth provider), DTOs (register, login, create-user, auth-response, oauth-callback-query).
- **infrastructure/** — Controllers (auth, user), validação (auth.validation, user.validation), middleware (auth, rate limit, request-id), persistência (Prisma: user, auth_credentials, oauth_accounts), mensageria (RabbitMQ publisher), auth (JWT, Argon2, Google/GitHub OAuth).

Composition root: `src/container.ts`. Entry: `src/index.ts`.

## Onde achar as coisas

| O quê | Onde |
|------|------|
| Entidades e value objects | `src/domain/entities/`, `src/domain/value-objects/` |
| Interfaces de repositório | `src/domain/repository-interfaces/` |
| Use cases | `src/application/use-cases/` |
| Portas | `src/application/ports/` |
| DTOs (entrada/saída, erros) | `src/application/dtos/` (auth-common.schema, register, login, create-user, auth-response, oauth-callback-query) |
| Rotas e controllers | `src/infrastructure/http/` (auth.routes, auth.controller, user.controller, routes.ts) |
| Persistência | `src/infrastructure/persistence/` |
| Composition root | `src/container.ts` |

## Documentação geral

- [ARCHITECTURE](../../../docs/ARCHITECTURE.md) — visão do framework e do shared
- [STRUCTURE](../../../docs/STRUCTURE.md) — árvore e convenções
- [API](../../../docs/API.md) — endpoints e autenticação
- [DEVELOPMENT](../../../docs/DEVELOPMENT.md) — rodar, testar, troubleshooting
- [SECURITY](../../../docs/SECURITY.md) — validação e segurança
