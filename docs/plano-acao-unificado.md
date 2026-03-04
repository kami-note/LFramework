# Plano de Ação Unificado — LFramework

## Introdução

Este documento consolida as sugestões, riscos e ações dos **quatro code reviews** realizados no projeto LFramework em um único plano executável. Os reviews cobriram:

- **Arquitetura** (Clean/Hexagonal): conformidade de camadas, composition root, bounded contexts, convenções shared/DTOs.
- **Segurança** (OWASP): controle de acesso (IDOR, roles), secrets, autenticação, validação de entrada, PII em logs.
- **Qualidade de código** (SOLID, DRY, tipagem): tratamento de erros, centralização de sendError, duplicação create-user/register, validação de payloads.
- **Testes e documentação**: pirâmide de testes (Vitest), OpenAPI, troubleshooting, logging estruturado e middleware de erro global.

Itens duplicados entre os documentos foram unificados (ex.: centralizar `sendError` aparece em qualidade e em testes-docs como um único item). A priorização segue: **risco de segurança > quebra de contrato/IDOR > consistência de código > testes > documentação > melhorias opcionais**.

---

## Tabela resumo por prioridade

| Prioridade | Quantidade | Foco |
|------------|------------|------|
| **P0** | 2 | Segurança crítica (IDOR, controle de acesso admin) |
| **P1** | 6 | Segurança média + qualidade que desbloqueia testes e contrato de erros |
| **P2** | 7 | Qualidade, arquitetura, testes unitários, logging |
| **P3** | 7 | Documentação, OpenAPI, melhorias opcionais, mais testes |

---

## Detalhamento por prioridade

### P0 — Segurança crítica (fazer primeiro)

| # | Título curto | Origem | Descrição | Arquivos / áreas | Dependências |
|---|--------------|--------|-----------|------------------|--------------|
| P0.1 | Corrigir IDOR em GET /api/users/:id | Segurança | Garantir que apenas o próprio usuário (ou role admin) possa ver o recurso; hoje qualquer autenticado pode ler outro usuário por ID. | `identity-service`: `user.controller.ts` (getById), `get-user-by-id.use-case.ts` | Nenhuma |
| P0.2 | Restringir POST /api/users a role admin | Segurança | Incluir claim de role no JWT, criar middleware `requireRole('admin')` e aplicar em POST /api/users; ou remover endpoint e usar apenas fluxo de registro. | `identity-service`: `routes.ts`, DTO create-user, auth (login/registro/OAuth para preencher role), novo middleware | Nenhuma |

---

### P1 — Segurança média e qualidade que desbloqueia

| # | Título curto | Origem | Descrição | Arquivos / áreas | Dependências |
|---|--------------|--------|-----------|------------------|--------------|
| P1.1 | Política de acesso para /api/items | Segurança | Definir e implementar: se criação é restrita, exigir JWT (ou API key) em POST /api/items; documentar no README/ARCHITECTURE quem pode acessar o quê. | `catalog-service`: `routes.ts`, `item.controller.ts`; docs | Nenhuma |
| P1.2 | Remover fallbacks de credenciais em produção | Segurança | Em produção, não usar fallbacks com connection strings no código; falhar na subida se IDENTITY_DATABASE_URL, CATALOG_DATABASE_URL, REDIS_URL, RABBITMQ_URL estiverem ausentes. | `identity-service/src/index.ts`, `catalog-service/src/index.ts` | Nenhuma |
| P1.3 | Logout/revogação de token | Segurança | Curto prazo: documentar que logout é remoção do token no cliente; considerar reduzir JWT_EXPIRES_IN ou refresh tokens. Médio prazo (opcional): blacklist no Redis (jti/token com TTL) e checagem no authMiddleware. | `identity-service`: auth.routes, auth.middleware, container; docs | Nenhuma |
| P1.4 | Validar :id como UUID em GET /api/users/:id | Segurança | Validar formato UUID antes de chamar o use case (ex.: Zod `z.string().uuid()`); responder 400 para formato inválido em vez de 404. | `identity-service`: `user.controller.ts` ou middleware de validação de params | Nenhuma |
| P1.5 | Reduzir PII em logs (catalog UserCreated) | Segurança | Remover ou restringir log de userId/email no callback UserCreated; em produção logar apenas identificador opaco ou desativar nível debug. | `catalog-service/src/index.ts` (e/ou handler UserCreated quando extraído) | Pode ser feito junto com P2.1 |
| P1.6 | Centralizar sendError (identity + catalog) | Qualidade / Testes-docs | Criar `sendError(res, status, message)` em cada serviço (ou em shared) e usar em todos os controllers e auth.middleware; elimina casts e garante formato único `{ error: string }` para testes e OpenAPI. | identity: `utils/send-error.ts`, auth.controller, user.controller; catalog: idem, item.controller; opcional: `shared/src/http/send-error.ts` | Recomendado após P0 para não misturar mudanças |

---

### P2 — Qualidade, arquitetura, testes e logging

| # | Título curto | Origem | Descrição | Arquivos / áreas | Dependências |
|---|--------------|--------|-----------|------------------|--------------|
| P2.1 | Extrair handler UserCreated para use case (catalog) | Arquitetura | Criar HandleUserCreatedUseCase (ou similar), registrar no container e chamar no connectRabbitMQ; manter index só com wiring. Quando houver regras (perfil local, invalidar cache), ficam na application. | `catalog-service`: `application/use-cases/`, `container.ts`, `index.ts` | Nenhuma |
| P2.2 | Validar payload UserCreated com Zod no consumer | Qualidade | Em vez de `body.payload as UserCreatedPayload`, validar com schema Zod (em shared ou catalog); se inválido, logar e nack. | `catalog-service`: `rabbitmq-user-created.consumer.ts`; opcional: schema em `@lframework/shared` | Nenhuma |
| P2.3 | Documentar convenção shared e composition root | Arquitetura | Nos ARCHITECTURE.md: composition root em `src/container.ts`; shared com porta de cache, adapter Redis, eventos, constantes RabbitMQ; application pode depender de shared para portas/contratos; nenhum serviço importa outro. | `ARCHITECTURE.md` (cada serviço ou doc único monorepo) | Nenhuma |
| P2.4 | Documentar convenção de DTOs (application vs infrastructure) | Arquitetura / Qualidade | No ARCHITECTURE.md: DTOs de entrada/saída e erros em `application/dtos/`; DTOs puramente HTTP (ex.: health) em `infrastructure/http/dtos/`; ResultDto = retorno de use case, ResponseDto = contrato HTTP. | `ARCHITECTURE.md` (identity e catalog) | Nenhuma |
| P2.5 | Testes unitários dos use cases (Vitest) | Testes-docs | Implementar testes com mocks (repositório, cache, eventPublisher): identity (CreateUser, Register, Login, GetUserById, GetCurrentUser) depois catalog (CreateItem, ListItems). Exemplo: CreateUserUseCase com InvalidEmailError, UserAlreadyExistsError e fluxo de sucesso. | `packages/identity-service`, `packages/catalog-service`: `*.spec.ts` ao lado dos use cases; vitest.config.ts; package.json scripts | Recomendado após P1.6 (contrato de erro estável) |
| P2.6 | Logging estruturado e middleware de erro global | Testes-docs | Introduzir Pino (ou Winston); requestId em todos os logs e header X-Request-Id; log de 500 antes de responder; middleware de erro global (4 args) com resposta 500 e `{ error: "Internal server error" }` sem vazar detalhes. | Ambos os serviços: logger, middleware requestId, middleware de erro, controllers (next(err) onde fizer sentido) | Nenhuma |
| P2.7 | DRY create-user vs register (publishUserCreatedAndCache) | Qualidade | Extrair função ou módulo que faz publish(USER_CREATED_EVENT) e cache.set; CreateUserUseCase e RegisterUseCase chamam após criar o User. | `identity-service`: `application/services/user-created-notify.ts` (ou helper), create-user.use-case.ts, register.use-case.ts | Nenhuma |

---

### P3 — Documentação e melhorias opcionais

| # | Título curto | Origem | Descrição | Arquivos / áreas | Dependências |
|---|--------------|--------|-----------|------------------|--------------|
| P3.1 | Spec OpenAPI (docs/openapi.yaml) | Testes-docs | Criar spec com paths identity + catalog; requestBody, parameters, responses 2xx e 4xx/5xx com schema `{ "error": "string" }`; security Bearer JWT; referenciar no README ou API-GATEWAY. | `docs/openapi.yaml` (ou raiz); README / API-GATEWAY.md | Após P1.6 (contrato de erro formalizado) |
| P3.2 | docs/TROUBLESHOOTING.md e link no README | Testes-docs | Seção com formato de erro `{ error: string }`, tabela código HTTP → causa → onde olhar, dicas para 401/409/500; parágrafo no README com link. | `docs/TROUBLESHOOTING.md`, README principal | Nenhuma |
| P3.3 | Reexportar porta de cache em application/ports | Arquitetura | Em cada serviço, criar `application/ports/cache.port.ts` reexportando ICacheService de shared; use cases importam de ../ports. Opcional para reduzir acoplamento application → shared. | identity e catalog: `application/ports/cache.port.ts`; use cases | Nenhuma |
| P3.4 | Helper validateBody genérico (Zod) | Qualidade | Criar middleware genérico `validateBody<T>(schema)` que faz safeParse, sendValidationError ou req.body = result.data; reduz repetição em user.validation, item.validation, auth.validation. | identity e catalog: `utils/validate-body.ts` ou similar; routes | Nenhuma |
| P3.5 | Documentar convenção domain/types.ts | Arquitetura | Se catalog passar a ter tipos de domínio canônicos, usar `domain/types.ts` como no identity; mencionar em convenções do monorepo. | ARCHITECTURE ou doc de convenções | Nenhuma |
| P3.6 | Mais testes: Zod, controllers, DB, E2E | Testes-docs | Testes dos schemas Zod; integração HTTP com use case mockado; integração com DB (Prisma + DB de teste); E2E via gateway (health + um fluxo por serviço). | Pacotes de serviço; gateway se E2E | Após P2.5 |
| P3.7 | sendValidationError / ErrorResponseDto em shared (opcional) | Qualidade | Extrair para shared apenas se quiser eliminar duplicação; manter tipos mínimos para shared não depender de Express. Alternativa: manter por serviço e documentar. | `packages/shared/src/http/`; identity e catalog imports | Nenhuma |

---

## Resumo por tema

- **Segurança:** P0.1, P0.2, P1.1, P1.2, P1.3, P1.4, P1.5  
- **Qualidade:** P1.6, P2.2, P2.7, P3.4, P3.7  
- **Arquitetura:** P2.1, P2.3, P2.4, P3.3, P3.5  
- **Testes:** P2.5, P3.1, P3.6  
- **Documentação / Logging:** P2.6, P3.1, P3.2  

---

## Checklist executável

Use este checklist para marcar o progresso. Ordem sugerida: P0 → P1 → P2 → P3 (dentro de cada prioridade, seguir a ordem da tabela quando fizer sentido).

### P0 — Segurança crítica
- [ ] P0.1 — Corrigir IDOR em GET /api/users/:id (ownership ou admin)
- [ ] P0.2 — Restringir POST /api/users a role admin (middleware + JWT role)

### P1 — Segurança e qualidade
- [ ] P1.1 — Definir e implementar política de acesso para /api/items
- [ ] P1.2 — Remover fallbacks de connection strings em produção
- [ ] P1.3 — Documentar logout; opcional: blacklist de token no Redis
- [ ] P1.4 — Validar :id como UUID em GET /api/users/:id
- [ ] P1.5 — Reduzir PII em logs (catalog UserCreated)
- [ ] P1.6 — Centralizar sendError (identity e catalog)

### P2 — Qualidade, arquitetura, testes e logging
- [ ] P2.1 — Extrair handler UserCreated para use case no catalog
- [ ] P2.2 — Validar payload UserCreated com Zod no consumer
- [ ] P2.3 — Documentar convenção shared e composition root no ARCHITECTURE
- [ ] P2.4 — Documentar convenção de DTOs no ARCHITECTURE
- [ ] P2.5 — Testes unitários dos use cases (Vitest, identity depois catalog)
- [ ] P2.6 — Logging estruturado (Pino), requestId, middleware de erro global
- [ ] P2.7 — DRY create-user vs register (publishUserCreatedAndCache)

### P3 — Documentação e opcionais
- [ ] P3.1 — Criar spec OpenAPI (docs/openapi.yaml) e referenciar
- [ ] P3.2 — Criar docs/TROUBLESHOOTING.md e link no README
- [ ] P3.3 — (Opcional) Reexportar porta de cache em application/ports
- [ ] P3.4 — (Opcional) Helper validateBody genérico para Zod
- [ ] P3.5 — Documentar convenção domain/types.ts
- [ ] P3.6 — Testes Zod, controllers, integração DB, E2E
- [ ] P3.7 — (Opcional) sendValidationError/ErrorResponseDto em shared

---

*Documento gerado a partir da consolidação dos code reviews: arquitetura (Clean/Hexagonal), segurança (OWASP), qualidade de código e testes/documentação. Contexto adicional: revisao-arquitetura-estrutura.md, revisao-dtos-refatoracao.md.*
