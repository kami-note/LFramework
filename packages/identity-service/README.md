# Identity Service

Microserviço de identidade: autenticação (JWT), registro de usuários e OAuth (Google/GitHub).

- **Porta HTTP:** 3001 (ou `IDENTITY_SERVICE_PORT`)
- **Roteamento:** `/api` (users, auth); `/health`

## Variáveis de ambiente obrigatórias (produção)

- `IDENTITY_DATABASE_URL` — PostgreSQL
- `REDIS_URL` — Redis (cache, OAuth state)
- `RABBITMQ_URL` — RabbitMQ (eventos)
- `JWT_SECRET` — ≥ 32 caracteres
- `JWT_EXPIRES_IN_SECONDS`
- `BASE_URL` — URL base do serviço

OAuth (opcional): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.

## Rodar e testar

```bash
pnpm run dev   # http://localhost:3001
pnpm test      # Vitest (use cases, DTOs, controllers)
```

## Camadas (Hexagonal + DDD)

- **domain/** — Entidades (User, Email), eventos de domínio
- **application/** — Use cases, DTOs, ports (repositórios, token service, OAuth providers)
- **infrastructure/** — HTTP (Express, rotas), Prisma, Redis, RabbitMQ, adapters OAuth

Ver [README raiz](../../README.md) e [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
