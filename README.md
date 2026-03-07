# LFramework

Framework de referência em TypeScript para projetos com **DDD**, **Arquitetura Hexagonal** e **Microserviços**. Pensado para escalar: monorepo, convenções fixas e núcleo compartilhado (`@lframework/shared`) com formato de erro, validação e schemas comuns.

## Stack

- **TypeScript** (strict)
- **Monorepo** (pnpm workspaces)
- **PostgreSQL** (Prisma)
- **Redis** (cache)
- **RabbitMQ** (eventos entre serviços)
- **Express** (API HTTP)
- **Nginx** (API Gateway em Docker)

## Estrutura do repositório

```
LFramework/
├── packages/
│   ├── shared/             # Núcleo do framework: eventos, DTOs, HTTP helpers, schemas
│   ├── identity-service/   # Microserviço de identidade (auth, usuários)
│   └── catalog-service/    # Microserviço de catálogo (itens)
├── nginx/
│   └── nginx.conf          # API Gateway (proxy reverso)
├── docker-compose.yml      # Postgres, Redis, RabbitMQ, Nginx
└── docs/                   # Documentação
```

Cada serviço segue **hexagonal + DDD**: `domain/`, `application/`, `infrastructure/`. O guia [docs/STRUCTURE.md](docs/STRUCTURE.md) define onde colocar cada arquivo e como nomear (estilo Laravel).

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Visão do framework, shared como núcleo, camadas, convenções |
| [docs/STRUCTURE.md](docs/STRUCTURE.md) | Árvore de pastas, nomeação, checklist novo recurso / novo serviço |
| [docs/API.md](docs/API.md) | Gateway, endpoints, autenticação, exemplos |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Como rodar, testes, env, troubleshooting |
| [docs/SECURITY.md](docs/SECURITY.md) | Validação, limites, OWASP, boas práticas |
| [docs/CODE_REVIEW.md](docs/CODE_REVIEW.md) | Code review consolidado, problemas por severidade, recomendações |
| [docs/RESILIENCE.md](docs/RESILIENCE.md) | Timeouts, retries e política de resiliência |

## Como rodar

```bash
cp .env.example .env
pnpm install
pnpm docker:up
```

Migrações (uma vez):

```bash
pnpm --filter identity-service exec prisma migrate dev --name init --schema=./prisma/schema.prisma
pnpm --filter catalog-service exec prisma migrate dev --name init --schema=./prisma/schema.prisma
```

Para migrações futuras, ver [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

Serviços (em terminais separados ou ambos de uma vez):

```bash
pnpm dev:identity   # http://localhost:3001
pnpm dev:catalog    # http://localhost:3002
# ou: pnpm dev       # sobe os dois
```

Com o gateway: **http://localhost:8080** (prefixos `/identity/` e `/catalog/`). Detalhes em [docs/API.md](docs/API.md) e [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Testes

```bash
pnpm test
```

Roda Vitest em todos os pacotes (use cases, DTOs, controllers).

## Padrões

Ports & Adapters (Hexagonal), Repository, Inversão de dependência, DDD (entidade, value object, domain event), Use case, DTO, Publish-Subscribe (RabbitMQ). O shared expõe contrato de erro (`ErrorResponseDto`), helpers HTTP (`sendError`, `sendValidationError`) e schemas comuns (ex.: `nameSchema`) para manter consistência entre serviços à medida que o projeto escala.
