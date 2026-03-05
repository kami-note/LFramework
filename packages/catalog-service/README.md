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

## Camadas (Hexagonal + DDD)

- **domain/** — Entidade Item, eventos de domínio
- **application/** — Use cases (list/create/update/delete items), DTOs, ports (repositório, cache, invalidator)
- **infrastructure/** — HTTP (Express), Prisma, Redis, RabbitMQ consumer

Ver [README raiz](../../README.md) e [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
