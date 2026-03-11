# Arquitetura do LFramework

O LFramework é um **framework de referência** para projetos com DDD, Arquitetura Hexagonal e microserviços em TypeScript. A documentação aqui descreve a visão do framework, o papel do pacote shared e as convenções que permitem escalar (novos recursos e novos serviços) sem perder consistência.

---

## 1. Visão do framework

- **Objetivo:** servir de base ou referência para outros projetos (estilo Laravel: estrutura que ajuda e não atrapalha).
- **Escala:** novos serviços e novos recursos seguem a mesma árvore de pastas e convenções de nomeação; o núcleo compartilhado (`@lframework/shared`) centraliza contrato de erro, helpers HTTP e schemas de validação comuns.
- **Serviços não se importam entre si:** identity e catalog não dependem um do outro; a comunicação é por eventos (RabbitMQ) e contratos no shared.

---

## 2. O pacote `@lframework/shared` (núcleo)

O shared é o **núcleo do framework**. Contém o que vários serviços ou o ecossistema precisam usar em comum.

| Área | Conteúdo |
|------|----------|
| **Eventos** | Tipos de payload (ex.: `UserCreatedPayload`), nomes de eventos, constantes RabbitMQ (exchanges, filas). |
| **DTOs** | `ErrorResponseDto` (`{ error: string }`) — formato padrão de erro da API. |
| **HTTP** | `sendError`, `sendValidationError`, `createHealthHandler(serviceName)`, `createErrorToHttpMapper(mappings)`, `createValidateBody(schema)`; middlewares `requestIdMiddleware`, `errorHandlerMiddleware`, `createAuthMiddleware`, `requireRole`, `asyncHandler`; tipo `HttpErrorMapping`. |
| **Schemas** | `nameSchema` (Zod): nome de exibição (trim, min 1, max 200, sem emoji/tags). Usado em identity (user name), catalog (item name) e validação do payload UserCreated no consumer. |
| **Cache** | Porta `ICacheService` e adapter Redis (opcional por serviço). |
| **Tipos** | Tipos e constantes compartilhados (ex.: RabbitMQ). |

**Dependências do shared:** Express (tipos para `Response`), Zod (validação e tipo `ZodError`). Quem consome o framework já está nesse ecossistema; centralizar aqui mantém um único lugar para formato de erro e convenções de validação.

**O que não vai no shared:** regras de negócio de um único serviço, DTOs de API específicos de um contexto, configuração de bootstrap de cada app.

---

## 3. Layers (Hexagonal + DDD)

Each microservice in `packages/<name>-service/` follows the same division:

| Layer | Responsibility | What not to put there |
|-------|----------------|------------------------|
| **domain/** | Entities, value objects, domain types. Pure business rules. No I/O interfaces. | Implementations (Prisma, HTTP), DTOs, repository interfaces, infra details |
| **application/** | Use cases (orchestration), **all ports** (repository ports + other driven ports), DTOs, application errors. | Knowledge of HTTP/DB, frameworks, concrete adapters |
| **adapters/** | Concrete implementations. **Driving** = call into the app (HTTP, consumers). **Driven** = implement application ports (persistence, messaging, cache, auth). | Business rules, use cases |

- **Driving adapters:** HTTP controllers (`adapters/driving/http`), event consumers (`adapters/driving/messaging`). They call use cases.
- **Driven adapters:** Prisma repositories (`adapters/driven/persistence`), event publishers (`adapters/driven/messaging`), cache (`adapters/driven/cache`), notifiers (`adapters/driven/notifiers`), auth (`adapters/driven/auth`). They implement ports defined in `application/ports/`.
- **Composition root:** `container.ts` — single place where dependencies are wired (adapters + use cases + controllers). Nothing else instantiates concrete port implementations.
- **Entry:** `index.ts` — loads env, creates container, mounts Express, listen; on shutdown, disconnects messaging/DB.

---

## 4. Fluxo de uma requisição

1. **HTTP** → Rota Express (ex.: `POST /api/items`) com middlewares opcionais (validação Zod, auth, rate limit).
2. **Controller** → Converte body/params em DTOs, chama use case, devolve status e JSON. Usa `sendError` / `sendValidationError` do shared em caso de erro.
3. **Use case** → Orquestra a lógica; depende apenas de **portas** (interfaces). Não conhece Express nem Prisma.
4. **Portas / Adapters** → Use cases dependem de interfaces; implementações (Prisma, Redis, RabbitMQ, JWT) são injetadas pelo container.

---

## 5. DTOs e onde ficam

- **application/dtos/** — DTOs de entrada/saída e erros (ex.: `CreateUserDto`, `CreateItemDto`, `AuthResponseDto`). O `ErrorResponseDto` está no shared; os serviços importam de lá quando usam tipo ou já usam os helpers do shared.
- **infrastructure/http/dtos/** — DTOs puramente HTTP (ex.: health). Opcional.
- **Convenção:** nome que termina em `Dto` = contrato de dados; `ResponseDto` = resposta HTTP; `ErrorResponseDto` = corpo de erro padrão.

---

## 6. Eventos entre serviços

- O **Identity** publica o evento `user.created` no RabbitMQ quando um usuário é criado (registro ou OAuth).
- O **Catalog** consome esse evento (fila dedicada), valida o payload (sem confiar no publisher) com os mesmos critérios de nome/email/occurredAt e reage (ex.: invalidar cache do usuário).
- Contratos de eventos, payloads e constantes RabbitMQ ficam em `packages/shared`.

---

## 7. Resumo

- **Framework = convenções + shared.** O shared é o núcleo (erro, HTTP, schemas, eventos); os serviços seguem a mesma estrutura e importam do shared onde fizer sentido.
- **Um serviço = uma árvore fixa.** Ver [STRUCTURE.md](STRUCTURE.md) para mapa de pastas e checklists.
- **Novo serviço = copiar árvore e renomear.** Mesma estrutura, mesmo padrão de container e rotas; eventos e contratos no shared.
- **Padrões replicáveis.** Ver [DESIGN_PATTERNS.md](DESIGN_PATTERNS.md) para Porta+Adapter (DIP) e Error-to-HTTP mapper (SRP/DRY); aplicáveis em qualquer novo use case ou microserviço.
