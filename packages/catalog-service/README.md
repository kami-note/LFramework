# Catalog Service

Microserviço de catálogo: CRUD de itens, cache Redis, consumo do evento UserCreated via RabbitMQ.

- **Porta HTTP:** 3002 (ou `CATALOG_SERVICE_PORT`)
- **Roteamento:** `/api` (items); `/health`

## Variáveis de ambiente obrigatórias (produção)

- `CATALOG_DATABASE_URL` — PostgreSQL
- `REDIS_URL` — Redis (cache de listagem)
- `RABBITMQ_URL` — RabbitMQ (UserCreated)
- `JWT_SECRET` — ≥ 32 caracteres (validação de tokens emitidos pelo identity-service)

## Rodar e testar

```bash
pnpm run dev   # http://localhost:3002
pnpm test      # Vitest (use cases, DTOs)
```

## Layers (Hexagonal + DDD)

- **domain/** — Item entity, value objects, domain types (no I/O interfaces)
- **application/** — Use cases (list/create items, handle-user-created), all ports (repository, cache invalidator, event consumer), DTOs
- **adapters/** — Driving: HTTP (Express), RabbitMQ consumer. Driven: Prisma, Redis cache invalidator

Ver [README raiz](../../README.md) e [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
