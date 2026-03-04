# Desenvolvimento — rodar, testar, ambiente, troubleshooting

---

## 1. Pré-requisitos e ambiente

```bash
cp .env.example .env
pnpm install
```

Configure no `.env` as variáveis de banco (`IDENTITY_DATABASE_URL`, `CATALOG_DATABASE_URL`), Redis (`REDIS_URL`), RabbitMQ (`RABBITMQ_URL`) e, se usar gateway, `GATEWAY_PORT` (default 8080). Para identity: `JWT_SECRET`, `BASE_URL`, e opcionalmente credenciais OAuth (Google/GitHub). O catalog também usa `JWT_SECRET` para validar tokens; use o mesmo valor em ambos os serviços.

---

## 2. Infraestrutura e gateway

```bash
pnpm docker:up
```

Sobe PostgreSQL (5432), Redis (6379), RabbitMQ (5672 + management 15672) e Nginx na porta 8080 (ou `GATEWAY_PORT`). Em Linux o gateway usa `host.docker.internal` para alcançar os serviços no host.

---

## 3. Migrações Prisma

Cada serviço tem seu próprio schema. Na primeira vez:

```bash
pnpm --filter identity-service exec prisma migrate dev --name init --schema=./prisma/schema.prisma
pnpm --filter catalog-service exec prisma migrate dev --name init --schema=./prisma/schema.prisma
```

Para novas migrations: `pnpm --filter <serviço> exec prisma migrate dev --name <nome> --schema=./prisma/schema.prisma`.

---

## 4. Rodar os serviços

Em terminais separados, ou na raiz com `pnpm dev` (sobe os dois em paralelo):

```bash
pnpm dev:identity   # http://localhost:3001
pnpm dev:catalog    # http://localhost:3002
# ou: pnpm dev       # raiz — sobe identity e catalog
```

Com o gateway no ar, use `http://localhost:8080` e os prefixos `/identity/` e `/catalog/` (ver [API.md](API.md)).

**CORS e rate limit:** O identity-service usa CORS (variável `CORS_ORIGIN`) e rate limiting em register/login/OAuth; o catalog-service não expõe CORS nem rate limit. Se o catalog for consumido por browser no mesmo domínio do identity, pode não precisar de CORS; para endpoints sensíveis (ex.: POST /api/items), considere adicionar rate limit conforme [SECURITY.md](SECURITY.md).

---

## 5. Testes

```bash
pnpm test
```

Roda Vitest em todos os pacotes (shared, identity, catalog). O shared tem testes próprios em `packages/shared` (middlewares HTTP, sendError, sendValidationError, auth). Identity e catalog testam use cases, DTOs (validação Zod) e controllers.

---

## 6. Build

Na raiz (builda todos os pacotes):

```bash
pnpm build
```

Ou por pacote:

```bash
pnpm --filter @lframework/shared build
pnpm --filter identity-service build
pnpm --filter catalog-service build
```

---

## 7. Troubleshooting

### Formato de erro da API

Respostas de erro: `{ "error": "string" }`. Em 500 o cliente vê apenas "Internal server error"; stack não é exposto.

### Códigos HTTP comuns

| Código | Causa provável |
|--------|----------------|
| **400** | Payload/query inválido (validação Zod): email, name, priceAmount, etc. |
| **401** | Token ausente, inválido ou expirado. Verificar `Authorization: Bearer <token>` e `JWT_SECRET`. |
| **403** | Token válido mas sem permissão (ex.: usuário acessando recurso de outro ou de admin). |
| **404** | Recurso não encontrado (ID inexistente). |
| **409** | Conflito (ex.: email já cadastrado). |
| **429** | Rate limit (login, register, OAuth). |
| **500** | Erro interno. Ver logs do serviço; usar header `X-Request-Id` para correlacionar. |

### 502 Bad Gateway (gateway)

Serviços no host (3001, 3002) não estão rodando ou não acessíveis. Teste: `curl http://localhost:3001/health` e `curl http://localhost:3002/health`. No Linux, confirme `host.docker.internal` no docker-compose para o Nginx.

### 401 com token “válido”

Identity e Catalog devem usar o **mesmo** `JWT_SECRET`. Se um gera e o outro valida, o secret tem de ser idêntico em ambos.

### Porta 8080 em uso

Altere `GATEWAY_PORT` no `.env` (ex.: 9080) e suba de novo o stack Docker.

### Alterações no nginx.conf

Reinicie o container: `docker compose restart nginx`.
