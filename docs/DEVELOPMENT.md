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

Roda Vitest em todos os pacotes (shared, identity, catalog). O shared tem testes próprios em `packages/shared` (middlewares HTTP, sendError, sendValidationError, auth, JwtTokenVerifier). Identity e catalog testam use cases, DTOs (validação Zod) e controllers.

### Auth e middlewares compartilhados

Toda a lógica de **auth** e middlewares HTTP comuns fica em `@lframework/shared` para evitar duplicação entre microserviços:

- **`createAuthMiddleware(verify)`** — valida `Authorization: Bearer <token>`, chama a função `verify(token)` e preenche `req.userId`, `req.userEmail`, `req.userRole`. Use com qualquer implementação de verificação (ex.: `(t) => tokenService.verify(t)` ou `(t) => tokenVerifier.verify(t)`).
- **`requireRole(role)`** — exige que o usuário autenticado tenha a role indicada; usar após o auth middleware.
- **`JwtTokenVerifier`** — implementação de `ITokenVerifier` (apenas verificação, HS256). Para serviços que **só validam** token (ex.: catalog), use `new JwtTokenVerifier(JWT_SECRET)` e `createAuthMiddleware((t) => verifier.verify(t))`. O identity-service continua com `JwtTokenService` (sign + verify) para emitir e validar tokens.
- **Outros**: `requestIdMiddleware`, `createErrorHandlerMiddleware`, `createValidateBody`, `asyncHandler`, `sendError`, `sendValidationError`.

Novos microserviços devem importar esses middlewares e o verifier do shared; não reimplementar auth nem validação de JWT em cada serviço.

### Helpers de mock (Express)

Para reduzir `req as any` e `res as Response` nos testes, use os helpers tipados do shared:

- **`createMockRequest(overrides?)`** — retorna um `Request` com defaults vazios (`headers`, `params`, `query`, `body`); `overrides` são fundidos em cima.
- **`createMockResponse()`** — retorna um `Response` com `status` (vi.fn().mockReturnThis()), `json`, `setHeader`, `headersSent: false`, etc.

Importe de `@lframework/shared/test` (subpath; não carrega vitest em produção):

```ts
import { createMockRequest, createMockResponse } from "@lframework/shared/test";
```

Exemplo em um spec de middleware:

```ts
const req = createMockRequest({ headers: { "x-request-id": "id-from-client" } });
const res = createMockResponse();
const next = vi.fn();
requestIdMiddleware(req, res, next);
expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "id-from-client");
expect(next).toHaveBeenCalled();
```

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

### 401 com token “válido” / JWT “invalid signature”

Identity e Catalog devem usar o **mesmo** `JWT_SECRET` (identity assina o token, catalog valida). No catalog: copie `packages/catalog-service/.env.example` para `packages/catalog-service/.env` e defina `JWT_SECRET` com o **mesmo valor** de `packages/identity-service/.env`. O catalog carrega `.env` do diretório do pacote ao iniciar.

### Tabela `replicated_users` não existe (catalog)

Se o catalog-service logar erro `The table public.replicated_users does not exist`, rode as migrações do catalog: `pnpm --filter catalog-service prisma:migrate` (ou `pnpm --filter catalog-service exec prisma migrate deploy` em produção).

### Porta 8080 em uso

Altere `GATEWAY_PORT` no `.env` (ex.: 9080) e suba de novo o stack Docker.

### Alterações no nginx.conf

Reinicie o container: `docker compose restart nginx`.

---

## 8. Resiliência (timeouts e retry)

Timeouts e política de retry para Redis, Prisma, RabbitMQ e chamadas HTTP (OAuth) estão documentados em [RESILIENCE.md](RESILIENCE.md).
