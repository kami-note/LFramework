# Code review — LFramework

Este documento consolida o code review do monorepo (packages: **shared**, **identity-service**, **catalog-service**), incluindo pontos positivos, problemas por severidade e recomendações prioritárias.

---

## 1. Pontos positivos

- **Arquitetura hexagonal consistente**: Ports em `application/ports/`, adapters em `adapters/driving/` e `adapters/driven/`, use cases dependendo só de interfaces; injeção feita no container; boa separação entre domínio e infra.
- **Validação de entrada**: Zod em register/login/create-user/create-item; `createValidateBody` no shared; validação de `params.id` (UUID) no user controller; consumer de UserCreated valida payload com schema próprio (não confia no publisher).
- **Segurança**: JWT com `algorithm: ["HS256"]`; verificação de `payload.sub` no auth middleware; rate limit em auth e OAuth; senha com Argon2; `JWT_SECRET` ≥ 32 chars em produção; email sem `<`/`>`; state OAuth em cache com TTL.
- **Erros de aplicação**: `AppError` base, subclasses por serviço, mapeamento centralizado em `error-to-http.mapper`, middleware de erro único, sem vazamento de stack (500 genérico).
- **Request ID**: Middleware com header limitado (256), propagado no log e resposta.
- **Tipagem**: `strict: true` nos tsconfigs; DTOs inferidos do Zod; poucos `any` fora de testes.
- **Testes**: Use cases, DTOs e controllers com specs; testes “absurd” para edge cases (body null/undefined, ids malformados); auth middleware e error handler testados no shared.
- **Documentação**: Comentários úteis em eventos, payloads, OAuth state, error mapping, async-handler.
- **Shutdown**: `SIGTERM` tratado com `disconnect()` (RabbitMQ, Prisma, Redis) antes de `process.exit`.

---

## 2. Problemas por severidade

### 2.1 Alto

| # | Arquivo | Problema | Sugestão |
|---|---------|----------|----------|
| 1 | `packages/catalog-service/src/index.ts` | **Resolvido:** CORS configurável por `CORS_ORIGIN` (igual ao identity). | — |
| 2 | `packages/identity-service/src/adapters/driving/http/auth.routes.ts` (linhas 40–41) | **`controller.me.bind(controller) as AsyncRequestHandler`** — cast para satisfazer tipo do asyncHandler; `googleRedirect`/`githubRedirect` não recebem `next`. | Tipar `asyncHandler` para aceitar handlers com assinatura `(req, res) => Promise<void>` ou `(req, res, next?) => Promise<void>`, evitando cast e mantendo type-safety. |
| 3 | `packages/catalog-service/src/adapters/driving/messaging/rabbitmq-user-created.consumer.ts` | **Resolvido:** consumer usa MAX_RETRIES, backoff e fila de falhas; nack sem requeue após N tentativas. | — |
| 4 | **Resiliência (geral)** | **Sem timeouts/retries** em Redis, Prisma, RabbitMQ, fetch (OAuth). | Definir timeouts (ex.: `connectTimeout`/`commandTimeout` no ioredis, timeout no Prisma, `AbortSignal` no fetch) e retry com backoff para dependências críticas; documentar política. |

### 2.2 Médio

| # | Arquivo | Problema | Sugestão |
|---|---------|----------|----------|
| 5 | `packages/shared/src/cache/redis-cache.adapter.ts` (linha 15) | **`JSON.parse(raw) as T`** — tipo não é garantido em runtime; cache corrompido ou malicioso pode quebrar ou passar dados inesperados. | Validar com Zod (ou schema) antes de retornar, ou retornar `unknown` e deixar o chamador validar; tratar formato inválido como “cache miss” (retornar null e opcionalmente logar). |
| 6 | `packages/identity-service/src/adapters/driven/auth/jwt-token.service.ts` (linha 29) | **`as TokenPayload & { role?: string }`** — confiança no shape do JWT. | Validar payload com Zod (sub, email?, role?, exp, iat) após decode e só então montar `TokenPayload`; rejeitar tokens com campos inesperados. |
| 7 | `packages/identity-service/src/adapters/driven/auth/github-oauth.provider.ts` (linha 65) | **`(await emRes.json()) as Array<...>`** — resposta da API externa não validada. | Parsear com Zod (array de objetos com email, primary opcional) e tratar falha como “email não disponível”. |
| 8 | **Testes** | **AuthController** e **error-to-http mappers** (identity e catalog) sem testes unitários. | Adicionar specs: auth (register/login/me/OAuth callback com validação/state inválido); mappers (cada classe de erro → status/mensagem esperados). |
| 9 | `packages/identity-service/src/adapters/driven/persistence/prisma-user.repository.ts` (linhas 6–8) | **`isPrismaP2002(err)`** usa cast genérico `(err as { code?: string }).code` — outros erros Prisma podem ter `code`. | Usar tipo do Prisma (ex.: `PrismaClientKnownRequestError`) e checar `err.code === 'P2002'` quando disponível, para não confundir com outros códigos. |
| 10 | `packages/shared/src/http/send-validation-error.ts` (linhas 10–12) | **Só primeiros erros de campo** (`flatten().fieldErrors`); erros de forma aninhada podem ficar de fora. | Documentar que a mensagem é “primeiro nível”; ou concatenar também `formErrors` e, se necessário, erros aninhados para 400 mais informativo. |

### 2.3 Baixo

| # | Arquivo / contexto | Problema | Sugestão |
|---|--------------------|----------|----------|
| 11 | `packages/identity-service/src/adapters/driving/http/auth.controller.ts` (linhas 75–80, 84–85) | **googleRedirect/githubRedirect** são `async` mas não usam `await` (só `performOAuthRedirect` é async). | Manter async por consistência com asyncHandler ou marcar como sync se não houver await; evita confusão. |
| 12 | `packages/catalog-service/src/application/use-cases/list-items.use-case.ts` (linha 16) | **`cached && Array.isArray(cached)`** — proteção correta, mas o tipo `get<T>` não garante que seja array. | Alinhar com a sugestão do Redis: cache retornar `unknown` ou tipo validado; aqui validar array (ex.: Zod) antes de usar. |
| 13 | **Duplicação** | **createErrorHandlerMiddleware** e **errorHandlerMiddleware** no shared — dois fluxos (com/sem mapper). | Manter os dois se o uso for distinto; senão, unificar em um único middleware que aceite mapper opcional e documentar o padrão. |
| 14 | `packages/identity-service/src/application/use-cases/register.use-case.ts` (linhas 33–35) | **`try { email = Email.create(dto.email); } catch { throw new InvalidEmailError(...) }`** — qualquer throw vira InvalidEmailError. | Se `Email.create` pode lançar outro tipo de erro, filtrar por tipo (ex.: só relançar como InvalidEmailError para erro de validação); senão documentar. |
| 15 | **Documentação** | Nenhum README ou doc de arquitetura na raiz dos serviços. | README por serviço (ou na raiz do monorepo) com: portas principais, env obrigatórios, como rodar testes e o que cada camada faz (resumido). |

### 2.4 Problemas resolvidos

| # | Arquivo / contexto | Problema | Resolução |
|---|--------------------|----------|-----------|
| (ex-2) | `packages/catalog-service` | **JWT verificado com `jsonwebtoken` direto** em vez de porta/abstração compartilhada. | Verificação de token centralizada em `@lframework/shared`: `JwtTokenVerifier` (implementa `ITokenVerifier`) + `createAuthMiddleware`. Catalog e futuros serviços usam o verifier do shared; identity continua com `JwtTokenService` (sign + verify) para emitir tokens. |
| (ex-6) | `packages/identity-service/src/index.ts` e catalog-service | **URLs default com credenciais** em prod. | Em `isProduction` as URLs (database, Redis, RabbitMQ) vêm apenas de `process.env`; fallback só em dev. Ver [SECURITY.md §3](./SECURITY.md). |
| (ex-13) | Vários `*.spec.ts` / `*.absurd.spec.ts` | **`req as any`**, **`res as Response`** em mocks. | Helpers tipados em `@lframework/shared/test`: `createMockRequest`, `createMockResponse`, `createMockAuthenticatedRequest`. Ver [DEVELOPMENT.md §5](./DEVELOPMENT.md). |

---

## 3. TypeScript

- **strict: true** em todos os pacotes — bom.
- **`any`**: Concentrado em testes (req/res mocks, `null as any`); em código de produção só aparece em testes absurd. Aceitável, mas melhorar com mocks tipados.
- **Type assertions**
  - **Produção**: `(req as RequestWithRequestId).requestId` (middleware) — poderia ser evitado estendendo `Express.Request` ou usando tipo genérico no middleware; `(err as Error).message` no factory — seguro após `instanceof`; `JSON.parse(raw) as T` no Redis — arriscado (ver item 5); JWT e respostas OAuth — melhor validar com schema.
- **Recomendação**: Manter strict; eliminar `as T` em dados externos/cache usando validação (Zod); reduzir `as any` nos testes com helpers tipados (ver secção 2.4).

---

## 4. Manutenibilidade e acoplamento

- **Dependências**: Fluxo claro (index → container → use cases + adapters); não há dependências circulares aparentes.
- **Duplicação**: Padrão de error-to-http repetido por serviço (esperado); pequena duplicação em auth (redirect/callback Google/GitHub) — aceitável.
- **Tamanho**: Arquivos e funções em tamanho razoável; nenhum arquivo excessivamente longo.
- **RequestWithRequestId**: Uso de cast no error-handler pode ser centralizado em um tipo “Request + requestId” usado em todos os middlewares.

---

## 5. Recomendações prioritárias (top 9)

1. **Resiliência**: Introduzir timeouts e retry com backoff para Redis, Prisma, RabbitMQ e chamadas HTTP (OAuth); definir política de retry no consumer (limite de requeue ou dead-letter).
2. **CORS no catalog-service**: Resolvido — CORS configurável por `CORS_ORIGIN` (paridade com identity-service). Ver §2.1 item 1.
3. **Concluído**: `JwtTokenVerifier` e `createAuthMiddleware` unificados no shared; catalog e novos serviços usam o mesmo verifier (ver §2.4).
4. **Validar payloads externos**: JWT (identity), respostas GitHub/Google OAuth e valor deserializado do Redis com Zod (ou equivalente); evitar `as T` em dados não controlados.
5. **Testes que faltam**: AuthController (register, login, me, OAuth callback, state inválido) e error-to-http mappers (identity e catalog); opcionalmente testes de integração para fluxos críticos (ex.: register → evento → catalog).
6. **Tipagem do asyncHandler e rotas**: Permitir handlers sem `next` e remover o cast em `me.bind(controller) as AsyncRequestHandler`; ajustar tipos em `auth.routes` e `routes` dos dois serviços.
7. **Consumer RabbitMQ**: Resolvido — retry limit, backoff e fila de falhas implementados no consumer UserCreated.
8. **README/arquitetura**: README na raiz e/ou por serviço com env, ports, como rodar e visão geral das camadas.
9. **Prisma P2002**: Usar tipo oficial do Prisma para erro e checar `code === 'P2002'` no user repository.

---

## 6. Referências

- [SECURITY.md](./SECURITY.md) — validação, limites e boas práticas de segurança.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — visão da arquitetura do projeto.
- [DEVELOPMENT.md](./DEVELOPMENT.md) — como desenvolver e rodar testes.
- [RESILIENCE.md](./RESILIENCE.md) — timeouts e política de retry (Redis, Prisma, RabbitMQ, OAuth).
