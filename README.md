# LFramework

Exemplo genérico de projeto com **DDD**, **Microserviços** e **Arquitetura Hexagonal**, em TypeScript, usando PostgreSQL, Redis e RabbitMQ. Use este repositório como base ou referência em outros projetos.

## Stack

- **TypeScript** (strict)
- **Monorepo** (pnpm workspaces)
- **PostgreSQL** (persistência, Prisma)
- **Redis** (cache)
- **RabbitMQ** (eventos entre serviços)
- **Express** (API HTTP)

## Estrutura

```
LFramework/
├── packages/
│   ├── shared/           # Eventos e tipos compartilhados entre serviços
│   ├── identity-service  # Microserviço de usuários (Identity)
│   └── catalog-service   # Microserviço de itens (Catalog)
├── docker-compose.yml    # Postgres, Redis, RabbitMQ
└── .env.example
```

Cada microserviço segue **hexagonal + DDD**:

- **domain/** – entidades, value objects, interfaces de repositório, eventos de domínio
- **application/** – casos de uso, portas (interfaces), DTOs
- **infrastructure/** – adapters: HTTP, persistência (Prisma), cache (Redis), mensageria (RabbitMQ)

## Como rodar

### 1. Dependências e variáveis

```bash
cp .env.example .env
pnpm install
```

### 2. Subir infraestrutura

```bash
pnpm docker:up
```

Isso sobe PostgreSQL (5432), Redis (6379) e RabbitMQ (5672 + management 15672).

### 3. Banco de dados (migrações Prisma)

Cada serviço tem seu próprio schema Prisma e gera o client em `packages/<serviço>/generated/prisma-client`; no exemplo usam o mesmo banco (você pode separar em produção).

```bash
pnpm --filter identity-service exec prisma migrate dev --name init --schema=./prisma/schema.prisma
pnpm --filter catalog-service exec prisma migrate dev --name init --schema=./prisma/schema.prisma
```

Ou, a partir da pasta do serviço: `cd packages/identity-service && pnpm prisma migrate dev --name init`.

### 4. Serviços

Em terminais separados:

```bash
pnpm dev:identity   # http://localhost:3001
pnpm dev:catalog    # http://localhost:3002
```

## Endpoints

### Identity Service (porta 3001)

- `POST /api/users` – criar usuário (`{ "email": "...", "name": "..." }`)
- `GET /api/users/:id` – buscar usuário por ID
- `GET /health` – health check

### Catalog Service (porta 3002)

- `POST /api/items` – criar item (`{ "name": "...", "priceAmount": 100, "priceCurrency": "BRL" }`)
- `GET /api/items` – listar itens (com cache Redis)
- `GET /health` – health check

## Eventos entre serviços

- O **Identity** publica o evento `user.created` no RabbitMQ quando um usuário é criado.
- O **Catalog** consome esse evento (fila `catalog.user_created`) e reage (ex.: log; em outros projetos: criar dados locais, invalidar cache, etc.).

Contratos de eventos e constantes RabbitMQ (exchanges, filas) ficam em `packages/shared`.

## Reutilizar em novos projetos

1. **Estrutura de pastas** – Copie a pasta de um serviço (ex.: `identity-service`) e renomeie; substitua entidades/agregados (ex.: `User` → seu agregado).
2. **Domain** – Novos agregados em `domain/entities` e `domain/aggregates`; value objects em `domain/value-objects`; interfaces de repositório em `domain/repository-interfaces`.
3. **Application** – Novos casos de uso em `application/use-cases`; novas portas em `application/ports`.
4. **Infrastructure** – Novos adapters em `infrastructure/` (persistence, cache, messaging, http).
5. **Portas** – As interfaces (ex.: `IUserRepository`, `ICacheService`, `IEventPublisher`) permitem trocar implementações (outro banco, outro cache) sem alterar domain/application.
6. **Shared** – Centralize eventos de domínio compartilhados e constantes RabbitMQ em `packages/shared`.

## Padrões de projeto

O desenho aplica: Ports & Adapters (Hexagonal), Repository, Dependency Inversion, Adapter, Entity/Value Object/Aggregate (DDD), Domain Event, Application Service (Use Case), DTO, Publish-Subscribe (RabbitMQ).
