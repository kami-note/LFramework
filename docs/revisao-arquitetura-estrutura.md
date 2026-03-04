# Code review: arquitetura e estrutura – LFramework

## Escopo

Avaliação da **organização de pastas e módulos**, **separação de responsabilidades**, **acoplamento entre pacotes**, **uso das camadas (domain, application, infrastructure)** e **consistência entre os serviços** (com foco em catalog-service e identity-service). Referências a arquivos/trechos quando relevante.

---

## 1. Visão geral da estrutura

- **Monorepo** (pnpm workspace): raiz + `packages/identity-service`, `packages/catalog-service`, `packages/shared`.
- **Serviços**: cada um com `src/domain`, `src/application`, `src/infrastructure`; entry em `src/index.ts`, composição em `src/container.ts`.
- **Shared**: cache (porta + adapter Redis), eventos (ex.: `UserCreatedPayload`), constantes RabbitMQ, tipos.

A estrutura segue **DDD + Hexagonal**: domínio no centro, aplicação orquestrando, infraestrutura como adaptadores.

---

## 2. Pontos positivos

### 2.1 Camadas bem definidas e direção de dependência

- **Domain** contém apenas entidades, value objects e interfaces de repositório. Não importa de `application` nem de `infrastructure`.
  - Ex.: `packages/identity-service/src/domain/entities/user.entity.ts` importa só `Email` (VO); `user-repository.interface.ts` importa só `User` (entidade).
  - Ex.: `packages/catalog-service/src/domain/entities/item.entity.ts` importa só `Money` (VO).
- **Application** (use cases, ports, DTOs, erros) depende do domain e, no que diz respeito a cache/eventos, do `@lframework/shared`. Não depende de Express, Prisma, RabbitMQ, etc.
- **Infrastructure** depende de application (use cases, ports, DTOs, errors) e de domain (entidades, interfaces de repositório). Controllers chamam use cases; adapters implementam portas.

Fluxo **HTTP → Controller → Use case → Ports** está alinhado com o descrito nos `ARCHITECTURE.md` de cada serviço.

### 2.2 Consistência entre identity-service e catalog-service

Estrutura de pastas espelhada:

| Camada        | identity-service                                      | catalog-service                               |
|---------------|--------------------------------------------------------|-----------------------------------------------|
| Domain        | `entities/`, `value-objects/`, `repository-interfaces/`, `types.ts` | `entities/`, `value-objects/`, `repository-interfaces/` |
| Application   | `use-cases/`, `ports/`, `dtos/`, `errors.ts`           | idem                                          |
| Infrastructure| `http/`, `persistence/`, `messaging/`, `auth/`         | `http/`, `persistence/`, `messaging/`         |

- **identity** tem `infrastructure/auth/` (JWT, Argon2, OAuth) por ser o bounded context de identidade; **catalog** não tem auth, o que é coerente.
- **Ports**: identity tem `event-publisher`, `token-service`, `password-hasher`, `oauth-provider`; catalog tem `event-consumer`. Cada serviço declara apenas as portas que usa.

### 2.3 Composition root e bootstrap

- `container.ts` na raiz de `src/` instancia repositórios, adapters (Redis, RabbitMQ), use cases e controllers. Um único ponto de composição por serviço.
- `index.ts` lê config (env), chama `createContainer`, monta o app Express e registra rotas e `/health`. Separação entre wiring e entrega HTTP está clara.

Exemplo identity:

```1:28:packages/identity-service/src/index.ts
import express from "express";
import cors from "cors";
import { createContainer } from "./container";
// ...
  const app = express();
  // ...
  app.use("/api", container.userRoutes);
  app.use("/api", container.authRoutes);
```

### 2.4 Sem acoplamento direto entre serviços

- Nenhum `import` de `identity-service` em `catalog-service` nem o contrário.
- Contrato entre serviços via **shared**: eventos (`UserCreatedPayload`, `USER_CREATED_EVENT`), constantes RabbitMQ (`EXCHANGE_USER_EVENTS`, `QUEUE_USER_CREATED_CATALOG`). Catalog consome evento publicado pelo identity; dependência é apenas em tipos/contratos compartilhados.

### 2.5 Repositórios e Prisma

- Interfaces de repositório em **domain** (`IUserRepository`, `IItemRepository`, etc.); implementações em **infrastructure/persistence** (Prisma).
- Cliente Prisma gerado por serviço (`../generated/prisma-client`), com schema próprio em `prisma/schema.prisma`. Isolamento de banco por serviço está respeitado.

### 2.6 Documentação de arquitetura

- Cada serviço tem `docs/ARCHITECTURE.md` com camadas, fluxo de request e tabela “Where to find things”. Facilita onboarding e manutenção.

---

## 3. Sugestões de melhoria

### 3.1 Porta de cache em `@lframework/shared` e dependência da application

**Situação:** A interface `ICacheService` está em `packages/shared/src/cache/cache.port.ts`. Os use cases de **identity** e **catalog** importam `ICacheService` (e às vezes `USER_CREATED_EVENT`) de `@lframework/shared`.

- **identity:** ex. `create-user.use-case.ts`, `get-user-by-id.use-case.ts`, `register.use-case.ts`, `oauth-callback.use-case.ts`.
- **catalog:** ex. `create-item.use-case.ts`, `list-items.use-case.ts`.

Assim, a camada de **application** dos dois serviços fica dependente do pacote shared. Em uma leitura estrita de hexagonal, as “portas” costumam ficar no próprio serviço (application/ports), e apenas contratos de integração (eventos, payloads) no shared.

**Sugestão:**

- **Opção A:** Mover (ou reexportar) a porta de cache para `application/ports` de cada serviço (ex.: `application/ports/cache.port.ts` com `export type ICacheService = import("@lframework/shared").ICacheService` ou cópia da interface). Assim, a aplicação não depende diretamente de shared para “porta”; o container continua injetando `RedisCacheAdapter` de shared.
- **Opção B:** Manter como está e **documentar** no `ARCHITECTURE.md` (e, se existir, num doc de convenções do monorepo) que o shared contém **portas cross-service** (cache) além de eventos e constantes, e que a application pode depender de shared para essas portas e contratos.

Ambas são válidas; o importante é deixar a regra explícita.

### 3.2 Localização do container e do “composition root”

**Situação:** `container.ts` está em `src/container.ts`, fora de `domain`, `application` e `infrastructure`.

**Sugestão:** Manter onde está é aceitável (composition root na raiz de `src` é comum). Se quiser deixar ainda mais explícito, pode-se criar `src/composition/container.ts` ou mencionar no `ARCHITECTURE.md` que o composition root fica em `src/container.ts` e não dentro de uma camada, para evitar que alguém mova para `application` ou `infrastructure` e quebre a ideia de “raiz de composição”.

### 3.3 Duplicação de `ErrorResponseDto` e `validation-response.ts`

**Situação:**

- `ErrorResponseDto` está definido de forma idêntica em:
  - `packages/identity-service/src/application/dtos/error-response.dto.ts`
  - `packages/catalog-service/src/application/dtos/error-response.dto.ts`
- `sendValidationError` (e o uso de `ErrorResponseDto`) está duplicado em:
  - `packages/identity-service/src/infrastructure/http/utils/validation-response.ts`
  - `packages/catalog-service/src/infrastructure/http/utils/validation-response.ts`

A revisão anterior de DTOs já recomenda manter DTOs de aplicação por serviço; para **ErrorResponseDto** isso é defensável (cada serviço pode evoluir o formato de erro). Para **validation-response.ts**, a lógica é genérica (Zod + resposta 400).

**Sugestão:**

- Manter `ErrorResponseDto` em cada serviço, como já decidido.
- **Opcional:** Extrair `sendValidationError` para um utilitário em `@lframework/shared` (ex.: `shared/src/http/validation-response.ts`) que receba `(res, zodError)` e use um tipo mínimo `{ error: string }`, ou manter duplicado e documentar que a duplicação é intencional para evitar que shared dependa de “DTO de aplicação” de qualquer serviço.

### 3.4 Barrel exports (index) em application

**Situação:** Em `application` há vários arquivos (use-cases, ports, dtos) mas não há barrels que facilitem imports como `from "../../application/use-cases"` ou `from "../../application/dtos"`.

**Sugestão:** Introduzir (ou completar) `application/use-cases/index.ts`, `application/ports/index.ts` e, se desejado, `application/dtos/index.ts`, reexportando os módulos públicos. Reduz ruído nos imports e deixa explícito o que é API pública da camada application. (Já há `application/ports/index.ts` e `application/use-cases/index.ts` em ambos os serviços; verificar se todos os use cases/ports estão exportados e se dtos teria ganho com barrel.)

### 3.5 HealthResponseDto e DTOs “só HTTP”

**Situação:** `HealthResponseDto` está em `infrastructure/http/dtos/` em ambos os serviços; `ErrorResponseDto` em `application/dtos/`. A revisão de DTOs já discute a convenção.

**Sugestão:** Documentar no `ARCHITECTURE.md` a regra adotada, por exemplo: “DTOs de resposta de use case e erros de aplicação em `application/dtos/`; DTOs puramente HTTP (ex.: health) em `infrastructure/http/dtos/`.”

### 3.6 CORS e tratamento de erros no bootstrap

**Situação:** No `identity-service`, o bootstrap configura CORS quando `CORS_ORIGIN` existe; no `catalog-service` não há configuração de CORS. Para um uso em que o catalog seja chamado só por outros serviços ou por um backend, isso pode ser intencional.

**Sugestão:** Se o catalog vier a ser acessado por frontends em outros origens, adicionar CORS de forma semelhante ao identity. Caso contrário, documentar que o catalog é “internal-only” ou que CORS não é necessário no cenário atual.

### 3.7 Documentação do shared no ARCHITECTURE.md

**Sugestão:** Em cada `ARCHITECTURE.md` (ou num doc único do monorepo), acrescentar uma subseção sobre o pacote **shared**, por exemplo:

- O que o shared contém: porta de cache (`ICacheService`), adapter Redis, eventos (`UserCreatedPayload`, `USER_CREATED_EVENT`), constantes RabbitMQ.
- Que a **application** pode depender de shared para essa porta e para contratos de eventos.
- Que **nenhum serviço** importa outro serviço; a comunicação é via mensagens (RabbitMQ) e contratos em shared.

---

## 4. Resumo

| Aspecto                    | Avaliação |
|---------------------------|-----------|
| Organização de pastas      | Muito boa; domain/application/infrastructure consistentes entre serviços. |
| Separação de responsabilidades | Clara; domain puro, application orquestra, infrastructure adapta. |
| Acoplamento entre pacotes  | Bom; sem dependência entre serviços; shared usado para cache, eventos e constantes. |
| Uso das camadas            | Correto; dependências seguem domain ← application ← infrastructure. |
| Consistência (catalog vs identity) | Alta; mesma estrutura; diferenças (auth, número de portas) refletem o domínio. |

**Principais ações sugeridas:**

1. Documentar no `ARCHITECTURE.md` a convenção sobre shared (porta de cache, eventos, e que application pode depender de shared para isso).
2. Documentar localização de DTOs (application vs infrastructure/http/dtos), incluindo Health e Error.
3. (Opcional) Decidir se a porta de cache fica em shared ou é reexportada/duplicada em `application/ports` de cada serviço, e documentar.
4. (Opcional) Barrel exports em `application` e, se desejado, utilitário compartilhado para `sendValidationError`.

Com isso, a arquitetura e a estrutura do LFramework ficam fáceis de seguir e de evoluir de forma consistente.
