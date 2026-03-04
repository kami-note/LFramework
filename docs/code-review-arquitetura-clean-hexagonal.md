# Code review: arquitetura LFramework (Clean Architecture + Hexagonal)

**Escopo:** Verificação da arquitetura do monorepo LFramework com base em Clean Architecture e Hexagonal, usando o checklist abaixo. Contexto: `docs/revisao-arquitetura-estrutura.md` e `ARCHITECTURE.md` dos pacotes.

---

## (a) Tabela de conformidade

| # | Item | Conformidade | Onde falha / observação |
|---|------|--------------|--------------------------|
| 1 | **Regra das dependências** | **Sim** | Domain não importa application nem infrastructure (verificado em todos os arquivos de `domain/`). Application não importa infrastructure (nenhum `from "../infrastructure"` ou similar em `application/`). Não há vazamentos de tipos de framework no domain (sem express, prisma, redis, rabbitmq em `domain/`). A application importa `@lframework/shared` (ICacheService, USER_CREATED_EVENT, UserCreatedPayload) por decisão de design; shared não é “infrastructure” do serviço. |
| 2 | **Limites (portas/adaptadores)** | **Sim** | Portas (interfaces) estão em `application/ports/` em ambos os serviços (event-publisher, token-service, password-hasher, oauth-provider, event-consumer, cache via shared). Adaptadores estão em `infrastructure/` (persistence, messaging, auth, http). Use cases dependem explicitamente de interfaces (ex.: `IUserRepository`, `ICacheService`, `IEventPublisher`) injetadas no construtor; inversão de dependência respeitada. |
| 3 | **Composition root** | **Sim** | Existe um único ponto de composição por serviço: `src/container.ts`. Ele instancia Prisma, Redis, adapters, use cases e controllers; está fora de `domain/`, `application/` e `infrastructure/` (na raiz de `src/`). O `index.ts` apenas lê config, chama `createContainer()` e monta o app Express; não contém regras de negócio. |
| 4 | **Bounded contexts** | **Sim** | identity-service e catalog-service não se importam mutuamente. Fronteiras claras: comunicação via mensagens (RabbitMQ) e contratos em `@lframework/shared`. Shared contém: interfaces/contratos (cache.port, UserCreatedPayload, constantes RabbitMQ), tipos vazios e um adapter (Redis). Não há lógica de negócio de domínio no shared; o Redis adapter é apenas serialização/Redis. |
| 5 | **Consistência entre serviços** | **Sim** | Mesma estrutura: `domain/entities`, `value-objects`, `repository-interfaces`; `application/use-cases`, `ports`, `dtos`, `errors`; `infrastructure/http`, `persistence`, `messaging`. identity tem ainda `domain/types.ts` e `infrastructure/auth/`; catalog não tem auth (coerente com o contexto) e não possui `types.ts` (não necessário hoje). Convenções de nomes e organização alinhadas. |

---

## (b) Violações identificadas

Não há violações críticas da regra de dependências nem dos limites hexagonais. Pontos que merecem atenção (mais de “decisão a documentar” do que violação):

1. **Application depende de shared para “porta” de cache**  
   - **Onde:** `packages/identity-service/src/application/use-cases/create-user.use-case.ts`, `get-user-by-id.use-case.ts`, `register.use-case.ts`, `oauth-callback.use-case.ts`; `packages/catalog-service/src/application/use-cases/create-item.use-case.ts`, `list-items.use-case.ts`.  
   - **Trecho (exemplo):**  
     `import type { ICacheService } from "@lframework/shared";`  
     `import { USER_CREATED_EVENT } from "@lframework/shared";`  
   - **Natureza:** Em leitura estrita, portas poderiam ficar no próprio serviço (application/ports). Hoje a porta de cache está em shared e a application depende de shared. Isso já está discutido em `revisao-arquitetura-estrutura.md` (opções A e B); não é violação se a convenção for documentada.

2. **Handler de UserCreated no catalog está no bootstrap, não em use case**  
   - **Onde:** `packages/catalog-service/src/index.ts` (linhas 19–22).  
   - **Trecho:**  
     `await container.connectRabbitMQ(async (payload) => {`  
       `console.log("[Catalog] UserCreated received:", payload.userId, payload.email);`  
       `// Ponto de extensão: criar dados locais, invalidar cache, etc.`  
     `});`  
   - **Natureza:** A reação ao evento “user created” está no entry point. Se no futuro houver lógica de negócio (criar dados locais, invalidar cache), o ideal é extrair para um use case e injetá-lo no container, mantendo o bootstrap só com wiring.

3. **Porta de event-consumer depende do tipo em shared**  
   - **Onde:** `packages/catalog-service/src/application/ports/event-consumer.port.ts`.  
   - **Trecho:**  
     `import type { UserCreatedPayload } from "@lframework/shared";`  
     `export interface IEventConsumer {`  
       `onUserCreated(handler: (payload: UserCreatedPayload) => Promise<void>): void;`  
     `}`  
   - **Natureza:** A application do catalog depende de shared para o contrato do evento. Consistente com “shared = contratos”; não é violação, mas reforça a dependência application → shared.

Nenhum trecho em `domain/` importa application, infrastructure ou frameworks. Nenhum trecho em `application/` importa `infrastructure/`.

---

## (c) Sugestões priorizadas (com impacto)

1. **Documentar convenção shared e composition root nos ARCHITECTURE.md**  
   - **Impacto:** Alto (clareza e onboarding).  
   - **Ação:** Em cada `ARCHITECTURE.md` (ou em um doc único do monorepo), acrescentar: (a) que o **composition root** é o `src/container.ts` e fica fora das camadas de negócio; (b) que o **shared** contém porta de cache (`ICacheService`), adapter Redis, eventos (`UserCreatedPayload`, `USER_CREATED_EVENT`) e constantes RabbitMQ; (c) que a **application** pode depender de shared para essas portas e contratos; (d) que nenhum serviço importa outro — comunicação via mensagens e contratos em shared.  
   - Reduz dúvidas sobre “onde colocar o wiring” e “se application pode depender de shared”.

2. **Extrair handler UserCreated para um use case no catalog**  
   - **Impacto:** Médio (evita lógica de negócio no bootstrap).  
   - **Ação:** Criar algo como `HandleUserCreatedUseCase` em `catalog-service/src/application/use-cases/`, que receba apenas o que for necessário (ex.: repositório de usuário local ou serviço de cache). No container, instanciar esse use case e registrar `(payload) => handleUserCreatedUseCase.execute(payload)` em `connectRabbitMQ`. Manter em `index.ts` apenas a chamada ao container.  
   - Quando houver regras (ex.: criar perfil local, invalidar cache), elas ficam na application, não no entry point.

3. **Reexportar (ou duplicar) a porta de cache em application/ports de cada serviço**  
   - **Impacto:** Médio (reduz acoplamento application → shared; opcional).  
   - **Ação:** Em cada serviço, criar `application/ports/cache.port.ts` com `export type ICacheService = import("@lframework/shared").ICacheService` (ou cópia da interface). Use cases passam a importar de `../ports/cache.port`. O container continua injetando `RedisCacheAdapter` de shared.  
   - Application deixa de depender de shared para “porta”; shared continua sendo usado apenas para implementação e para eventos/constantes.

4. **Documentar convenção de DTOs (application vs infrastructure)**  
   - **Impacto:** Médio (consistência).  
   - **Ação:** No `ARCHITECTURE.md`, registrar explicitamente: DTOs de entrada/saída de use cases e erros de aplicação em `application/dtos/`; DTOs puramente HTTP (ex.: health) em `infrastructure/http/dtos/`.  
   - Alinha HealthResponseDto e ErrorResponseDto com a regra e evita dúvidas em novos endpoints.

5. **Manter alinhada a convenção domain/types.ts**  
   - **Impacto:** Baixo (consistência futura).  
   - **Ação:** identity-service tem `domain/types.ts` (ex.: `OAuthProvider`); catalog-service não tem. Se no futuro o catalog precisar de tipos de domínio “canônicos” no próprio serviço, usar a mesma convenção (`domain/types.ts`). Pode ser mencionado em uma seção de convenções do monorepo.  
   - Garante que os dois serviços continuem espelhados na estrutura de domain.

---

## Resumo

- **Regra das dependências:** Respeitada (domain puro; application não importa infrastructure; sem vazamento de framework no domain).  
- **Limites:** Portas na application, adaptadores na infrastructure; use cases dependem de interfaces.  
- **Composition root:** Único por serviço em `src/container.ts`, fora das camadas de negócio.  
- **Bounded contexts:** identity e catalog com fronteiras claras; shared com contratos/eventos e um adapter (Redis), sem lógica de negócio.  
- **Consistência:** Mesma estrutura de pastas e convenções entre identity-service e catalog-service.

As sugestões acima priorizam documentação e pequenos ajustes (handler em use case, opção de reexportar a porta de cache) para reforçar a arquitetura sem mudanças estruturais grandes.
