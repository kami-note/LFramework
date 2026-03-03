# LFramework

Exemplo genérico de projeto com **DDD**, **Microserviços** e **Arquitetura Hexagonal**, em TypeScript, usando PostgreSQL, Redis e RabbitMQ. Use este repositório como base ou referência em outros projetos.

## Stack

- **TypeScript** (strict)
- **Monorepo** (pnpm workspaces)
- **PostgreSQL** (persistência, Prisma)
- **Redis** (cache)
- **RabbitMQ** (eventos entre serviços)
- **Express** (API HTTP)
- **Nginx** (API Gateway em Docker, proxy reverso para os microserviços)

## Estrutura

```
LFramework/
├── packages/
│   ├── shared/           # Eventos e tipos compartilhados entre serviços
│   ├── identity-service  # Microserviço de usuários (Identity)
│   └── catalog-service   # Microserviço de itens (Catalog)
├── nginx/
│   └── nginx.conf        # Configuração do API Gateway (proxy reverso)
├── docker-compose.yml    # Postgres, Redis, RabbitMQ, Nginx
└── .env.example
```

Cada microserviço segue **hexagonal + DDD** com estrutura e convenções fixas (onde colocar cada arquivo e como nomear):

- **domain/** – entidades, value objects, interfaces de repositório
- **application/** – casos de uso, portas (interfaces), DTOs
- **infrastructure/** – adapters: HTTP, persistência (Prisma), cache (Redis), mensageria (RabbitMQ)

→ **Guia completo:** [docs/STRUCTURE.md](docs/STRUCTURE.md) — mapa da árvore, convenções de nomeação, checklist para novo recurso e novo serviço (estilo Laravel: estrutura que ajuda e não atrapalha).

## Como rodar

### 1. Dependências e variáveis

```bash
cp .env.example .env
pnpm install
```

### 2. Subir infraestrutura e API Gateway

```bash
pnpm docker:up
```

Isso sobe PostgreSQL (5432), Redis (6379), RabbitMQ (5672 + management 15672) e **Nginx** como API Gateway (porta 8080 por padrão). O gateway faz proxy para os serviços; use `http://localhost:8080` como base (veja [API Gateway](#api-gateway)).

### 3. Banco de dados (migrações Prisma)

Cada serviço tem seu próprio schema Prisma e gera o client em `packages/<serviço>/generated/prisma-client`; no exemplo usam o mesmo banco (você pode separar em produção).

```bash
pnpm --filter identity-service exec prisma migrate dev --name init --schema=./prisma/schema.prisma
pnpm --filter catalog-service exec prisma migrate dev --name init --schema=./prisma/schema.prisma
```

Ou, a partir da pasta do serviço: `cd packages/identity-service && pnpm prisma migrate dev --name init`.

### 4. Serviços

Em terminais separados (ou um só com `pnpm run dev`):

```bash
pnpm dev:identity   # http://localhost:3001
pnpm dev:catalog    # http://localhost:3002
```

Com o gateway no ar, você pode chamar tudo por **http://localhost:8080** (veja [API Gateway](#api-gateway)).

## API Gateway

O Nginx em Docker expõe um único ponto de entrada (porta **8080**, configurável via `GATEWAY_PORT`):

| Prefixo      | Serviço  | Exemplos |
|-------------|-----------|----------|
| `/identity/` | identity-service | `GET /identity/health`, `POST /identity/api/users`, `GET /identity/api/users/:id` |
| `/catalog/`  | catalog-service  | `GET /catalog/health`, `GET /catalog/api/items`, `POST /catalog/api/items` |
| —            | gateway          | `GET /health` (health do próprio gateway) |

→ **Documentação completa:** [docs/API-GATEWAY.md](docs/API-GATEWAY.md) — rotas, exemplos com cURL, configuração e troubleshooting.

## Endpoints

Os serviços podem ser acessados **diretamente** (portas 3001 e 3002) ou **via API Gateway** (porta 8080, prefixos `/identity/` e `/catalog/`).

### Identity Service (porta 3001 ou gateway `/identity/`)

- `POST /api/users` – criar usuário (`{ "email": "...", "name": "..." }`)
- `GET /api/users/:id` – buscar usuário por ID
- `GET /health` – health check

### Catalog Service (porta 3002 ou gateway `/catalog/`)

- `POST /api/items` – criar item (`{ "name": "...", "priceAmount": 100, "priceCurrency": "BRL" }`)
- `GET /api/items` – listar itens (com cache Redis)
- `GET /health` – health check

## Eventos entre serviços

- O **Identity** publica o evento `user.created` no RabbitMQ quando um usuário é criado.
- O **Catalog** consome esse evento (fila `catalog.user_created`) e reage (ex.: log; em outros projetos: criar dados locais, invalidar cache, etc.).

Contratos de eventos e constantes RabbitMQ (exchanges, filas) ficam em `packages/shared`.

## Reutilizar em novos projetos

Siga o guia **[docs/STRUCTURE.md](docs/STRUCTURE.md)** para:

- **Novo recurso (entidade)** — checklist passo a passo: entity, repository interface, DTOs, use cases, controller, routes, container.
- **Novo microserviço** — copiar a árvore de um serviço, mesma estrutura e convenções de nomeação.
- **O que vai no shared** — apenas eventos compartilhados, constantes RabbitMQ e contratos usados por mais de um serviço.

Resumo: estrutura fixa por serviço; convenções de nomeação (ex.: `create-<entidade>.use-case.ts`, `prisma-<entidade>.repository.ts`); um único lugar para “onde coloco X”.

## Padrões de projeto

O desenho aplica: Ports & Adapters (Hexagonal), Repository, Dependency Inversion, Adapter, Entity/Value Object/Aggregate (DDD), Domain Event, Application Service (Use Case), DTO, Publish-Subscribe (RabbitMQ).
