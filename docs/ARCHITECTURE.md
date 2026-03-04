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
| **HTTP** | `sendError(res, status, message)` e `sendValidationError(res, zodError)` — respostas de erro padronizadas (400, 401, 500, etc.). |
| **Schemas** | `nameSchema` (Zod): nome de exibição (trim, min 1, max 200, sem emoji/tags). Usado em identity (user name), catalog (item name) e validação do payload UserCreated no consumer. |
| **Cache** | Porta `ICacheService` e adapter Redis (opcional por serviço). |
| **Tipos** | Tipos e constantes compartilhados (ex.: RabbitMQ). |

**Dependências do shared:** Express (tipos para `Response`), Zod (validação e tipo `ZodError`). Quem consome o framework já está nesse ecossistema; centralizar aqui mantém um único lugar para formato de erro e convenções de validação.

**O que não vai no shared:** regras de negócio de um único serviço, DTOs de API específicos de um contexto, configuração de bootstrap de cada app.

---

## 3. Camadas (hexagonal + DDD)

Cada microserviço em `packages/<nome>-service/` segue a mesma divisão:

| Camada | Responsabilidade | O que não colocar |
|--------|-------------------|--------------------|
| **domain/** | Entidades, value objects, interfaces de repositório. Regras de negócio puras. | Implementações (Prisma, HTTP), DTOs, detalhes de infra |
| **application/** | Use cases (orquestração), portas (interfaces), DTOs de entrada/saída, erros de aplicação. | Conhecimento de HTTP/DB, frameworks |
| **infrastructure/** | Controllers, repositórios Prisma, adapters RabbitMQ/Redis, middlewares. Tudo que fala com o mundo externo. | Regras de negócio |

- **Composition root:** `container.ts` — único ponto onde dependências são montadas (repositórios, use cases, controllers). Nada mais instancia implementações concretas de portas.
- **Entry:** `index.ts` — carrega env, cria container, monta Express, listen; em shutdown, desconecta messaging/DB.

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
