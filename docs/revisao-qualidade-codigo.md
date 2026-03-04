# Code review: qualidade de código – LFramework

## Escopo

Revisão de **qualidade de código** do LFramework com foco em SOLID, DRY, tipagem/DTOs, tratamento de erros e nomenclatura/convenções. Contexto: `docs/revisao-dtos-refatoracao.md` e `docs/revisao-arquitetura-estrutura.md`.

---

## (a) Lista de violações e inconsistências

### 1. SOLID

#### 1.1 Responsabilidade única (use cases e controllers)

| Local | Observação |
|-------|------------|
| **CreateUserUseCase** vs **RegisterUseCase** | Ambos fazem: validar email, checar existência, criar User, publicar USER_CREATED_EVENT, gravar cache com o mesmo formato. A orquestração é parecida; cada use case tem uma responsabilidade clara (criar usuário interno vs registro com senha), mas há **duplicação de lógica** (ver DRY). |
| **AuthController** | Responsabilidade única respeitada: orquestra rotas de auth e delega aos use cases. Método `handleOAuthCallback` poderia ser extraído para um helper em outro arquivo, mas não é violação grave. |
| **UserController**, **ItemController** | Cada um delega a 2 use cases; responsabilidade única ok. |

**Conclusão:** Use cases e controllers estão com responsabilidade única em geral. O ponto de atenção é a duplicação entre CreateUser e Register (lógica de evento + cache), não a SRP em si.

#### 1.2 Inversão de dependência (portas)

| Local | Observação |
|-------|------------|
| **Application → @lframework/shared** | Use cases dependem de `ICacheService` e `USER_CREATED_EVENT` do shared. A **porta** está no shared; a application não depende de Redis/implementação. Inversão respeitada. |
| **identity-service** | Use cases dependem de portas em `application/ports/` (IUserRepository, ITokenService, IPasswordHasher, IEventPublisher, IOAuthProvider, etc.); implementações em infrastructure. Ok. |
| **catalog-service** | Use cases dependem de IItemRepository, ICacheService, IEventConsumer. Ok. |

Nenhuma violação de inversão de dependência identificada.

#### 1.3 Interface segregation (portas)

| Porta | Métodos | Observação |
|-------|---------|------------|
| **IEventPublisher** | `publish(eventName, payload)` | Enxuta; quem só publica não é forçado a consumir. Ok. |
| **IOAuthProvider** | `getUserInfoFromCode`, `getAuthorizationUrl`, `readonly provider` | Coesa. Ok. |
| **ITokenService** | `sign`, `verify` | Coesa. Ok. |
| **ICacheService** | `get`, `set`, `delete` | Genérica; poderia ser segregada em “read” vs “write” se houvesse adapters só de leitura, mas não é o caso. Ok. |
| **IEventConsumer** (catalog) | Uso via `onUserCreated` no adapter | Porta em `event-consumer.port.ts`: apenas o contrato que o container precisa. Ok. |

Nenhuma violação de ISP identificada; portas são enxutas e coesas.

#### 1.4 Liskov (onde há hierarquia)

| Hierarquia | Observação |
|------------|------------|
| **Erros de aplicação** (`UserAlreadyExistsError`, `InvalidEmailError`, etc. extendem `Error`) | Usados em `catch` e tratados com `instanceof`; substituíveis por `Error` onde o controller faz fallback para 500. Comportamento esperado preservado. Ok. |
| **Adapters implementam portas** (PrismaUserRepository, JwtTokenService, RedisCacheAdapter, etc.) | Implementações respeitam as interfaces; não há subtipos que quebrem precondições/pós-condições. Ok. |
| **GoogleOAuthProvider / GitHubOAuthProvider** | Ambos implementam `IOAuthProvider`; AuthController usa via interface. Ok. |

Não há hierarquias problemáticas; LSP respeitado.

---

### 2. DRY e duplicação

| Duplicação | Arquivos | Linhas (ref.) |
|------------|----------|----------------|
| **ErrorResponseDto** idêntico | `packages/identity-service/src/application/dtos/error-response.dto.ts`, `packages/catalog-service/src/application/dtos/error-response.dto.ts` | 1–3 em ambos |
| **sendValidationError** idêntico | `packages/identity-service/src/infrastructure/http/utils/validation-response.ts`, `packages/catalog-service/src/infrastructure/http/utils/validation-response.ts` | 1–14 em ambos |
| **HealthResponseDto** idêntico | `packages/identity-service/src/infrastructure/http/dtos/health-response.dto.ts`, `packages/catalog-service/src/infrastructure/http/dtos/health-response.dto.ts` | 1–4 em ambos |
| **Padrão de tratamento de erro no controller** | user.controller monta `ErrorResponseDto` inline e usa `sendError` implícito em alguns branches; auth.controller usa `sendError`; item.controller monta body inline | user.controller 24–35, 42–49; item.controller 19–26, 33–36 |
| **create-user vs register** | CreateUserUseCase e RegisterUseCase: mesmo fluxo de Email.create, findByEmail, User.create, publish(USER_CREATED_EVENT), cache.set com o mesmo objeto | create-user.use-case.ts 19–59; register.use-case.ts 33–66 |
| **Validação de body** (validateCreateUser / validateCreateItem / validateRegister / validateLogin) | Mesmo padrão: schema.safeParse(req.body) → sendValidationError ou req.body = result.data | user.validation.ts 5–13; item.validation.ts 5–13; auth.validation.ts 6–22 |
| **Health em index.ts** | Ambos os serviços: `const body: HealthResponseDto = { status: "ok", service: "…" }; res.json(body);` | identity index.ts 53–56; catalog index.ts 28–31 |

---

### 3. Tipagem e DTOs

#### 3.1 Zod como fonte de verdade e z.infer

| Arquivo | Uso |
|---------|-----|
| create-user.dto.ts | `createUserSchema` + `export type CreateUserDto = z.infer<typeof createUserSchema>` ✅ |
| register.dto.ts | `registerSchema` + `export type RegisterDto = z.infer<typeof registerSchema>` ✅ |
| login.dto.ts | `loginSchema` + `export type LoginDto = z.infer<typeof loginSchema>` ✅ |
| oauth-callback-query.dto.ts | `oauthCallbackQuerySchema` + `export type OAuthCallbackQueryDto = z.infer<...>` ✅ |
| create-item.dto.ts | `createItemSchema` + `export type CreateItemDto = z.infer<...>` ✅ |

DTOs de entrada validados por Zod usam `z.infer` de forma consistente. Não há DTO de entrada sem schema Zod nos fluxos revisados.

#### 3.2 ErrorResponseDto e contratos de API

- **ErrorResponseDto**: mesmo formato `{ error: string }` em identity e catalog. Contratos alinhados.
- **auth.routes.ts** (rate limiter): `message: { error: "Too many attempts..." }` tem o mesmo formato. Consistente.

#### 3.3 Casts (`as`) e `any`

| Arquivo | Linha | Uso |
|---------|-------|-----|
| user.controller.ts | 35 | `res.status(500).json({ error: "Internal server error" } as ErrorResponseDto)` — cast desnecessário se usar sendError |
| user.controller.ts | 44 | `res.status(404).json({ error: "User not found" } as ErrorResponseDto)` — idem |
| user.controller.ts | 49 | `res.status(500).json({ error: "Internal server error" } as ErrorResponseDto)` — idem |
| jwt-token.service.ts | 27 | `decoded as TokenPayload` — jwt.verify retorna `object`; cast esperado após verify, mas poderia usar type guard ou schema Zod para decode |
| redis-cache.adapter.ts | 14, 16 | `JSON.parse(raw) as T` e `raw as unknown as T` — genérico sem runtime check; aceitável para cache interno |
| google-oauth.provider.ts | 13 | `readonly provider = "google" as const` — para literal type; ok |
| github-oauth.provider.ts | 13, 65 | `"github" as const` e `(await emRes.json()) as Array<...>` — array de emails da API do GitHub; cast por API externa |
| rabbitmq-user-created.consumer.ts | 39 | `body.payload as UserCreatedPayload` — payload do AMQP; sem validação Zod. Risco: se o formato mudar, runtime error. |

Nenhum uso de `any` encontrado nos pacotes.

**Resumo:** Tipagem em geral forte; os casts em controllers (user.controller) somem ao centralizar em sendError; o cast em rabbitmq-user-created.consumer poderia ser substituído por validação Zod do payload.

---

### 4. Tratamento de erros

| Local | Comportamento | Inconsistência? |
|------|----------------|------------------|
| **auth.controller** | Use cases lançam erros de domínio; controller usa `sendError(res, status, message)` em todos os branches (409, 400, 401, 404, 500, 503). Formato único. | ✅ Consistente |
| **user.controller** | Monta `ErrorResponseDto` inline em todos os branches; no 500 e 404 usa cast. Não usa função sendError. | ❌ Inconsistente com auth.controller |
| **item.controller** | Monta `const body: ErrorResponseDto = { ... }` e `res.status(...).json(body)` em todos os branches. Formato único, mas sem sendError. | ⚠️ Estilo diferente (inline vs sendError) |
| **auth.middleware** | Monta `ErrorResponseDto` inline e `res.status(401).json(body)`. | ⚠️ Mesmo formato, outro estilo |
| **validation-response.ts** (ambos) | `sendValidationError` monta ErrorResponseDto e envia 400. | ✅ Consistente entre serviços |

**Resumo:** Use cases lançam erros de domínio; controllers mapeiam para HTTP. A **inconsistência** está no **estilo**: auth.controller usa `sendError`; user.controller e item.controller montam o JSON manualmente; user.controller ainda usa cast em 3 linhas. Nenhum controller devolve formato diferente de `{ error: string }`.

---

### 5. Nomenclatura e convenções

| Aspecto | Situação |
|---------|----------|
| **ResultDto vs ResponseDto** | ResultDto (LoginResultDto, RegisterResultDto, OAuthCallbackResultDto) = retorno de use case; ResponseDto = contrato HTTP. Catalog não tem ResultDto (use cases retornam ItemResponseDto/UserResponseDto). Convenção está consistente e documentada em revisao-dtos-refatoracao. |
| **application/dtos vs infrastructure/http/dtos** | ErrorResponseDto, AuthResponseDto, UserResponseDto, CreateUserDto, etc. em application/dtos; HealthResponseDto em infrastructure/http/dtos em ambos. Convenção aplicada; falta documentar no ARCHITECTURE.md. |
| **Nomes de arquivos** | Use cases: `*.use-case.ts`; controllers: `*.controller.ts`; DTOs: `*.dto.ts`; portas: `*.port.ts`. Consistente. |
| **Pastas** | application/dtos, application/use-cases, application/ports; infrastructure/http, infrastructure/http/utils, infrastructure/http/dtos. Consistente entre identity e catalog. |

Nenhuma violação de nomenclatura ou convenção de pastas; apenas documentação da regra application vs infrastructure para DTOs ainda faltando.

---

## (b) Sugestões de refatoração concretas

1. **sendError centralizado (identity-service)**  
   - Criar `packages/identity-service/src/infrastructure/http/utils/send-error.ts` com:
     - `sendError(res: Response, status: number, message: string): void` montando `ErrorResponseDto` e fazendo `res.status(status).json(body)`.
   - Em **auth.controller**: remover a função local `sendError` (linhas 26–29) e importar de `./utils/send-error`.
   - Em **user.controller**: substituir todas as montagens manuais e casts por `sendError(res, 409, err.message)`, `sendError(res, 400, err.message)`, `sendError(res, 500, "Internal server error")`, `sendError(res, 404, "User not found")`. Assim eliminam-se os 3 casts e alinha-se o estilo ao auth.controller.

2. **sendError / sendValidationError em shared (opcional)**  
   - Criar `packages/shared/src/http/send-error.ts` com tipo mínimo `{ error: string }` e função `sendError(res, status, message)`.
   - Criar `packages/shared/src/http/send-validation-error.ts` com `sendValidationError(res, zodError)` (mesma lógica dos dois validation-response atuais).
   - Em identity e catalog: importar sendError e sendValidationError do shared; em cada serviço, manter `ErrorResponseDto` em application/dtos e reexportar ou usar o tipo do shared apenas na infra.  
   - Alternativa: manter sendValidationError em cada serviço (como hoje) e apenas unificar sendError no identity (item 1). A revisão de arquitetura já sugere manter ErrorResponseDto por serviço; a extração para shared é opcional.

3. **ErrorResponseDto e HealthResponseDto em shared (opcional)**  
   - Se quiser eliminar duplicação de tipos: criar `packages/shared/src/http/error-response.dto.ts` e `packages/shared/src/http/health-response.dto.ts` (ou um único `http-dtos.ts`) e importar em identity e catalog. Isso exige que shared não dependa de Express (apenas tipos).  
   - Alternativa recomendada: manter ErrorResponseDto e HealthResponseDto em cada serviço e documentar que o formato é intencionalmente igual.

4. **create-user vs register – extração de “create user aggregate”**  
   - Opção A (mais invasiva): extrair um “application service” ou helper interno que receba (userRepository, cache, eventPublisher, user: User) e faça apenas `eventPublisher.publish(USER_CREATED_EVENT, ...)` e `cache.set(...)`. CreateUserUseCase e RegisterUseCase chamariam esse helper após criar o User (e, no caso do Register, após persistir credencial).  
   - Opção B (mais simples): extrair função privada ou módulo `publishUserCreatedAndCache(user: User, eventPublisher, cache)` em um arquivo compartilhado dentro do identity-service (ex.: `application/services/user-created-notify.ts`) e usar em ambos os use cases.  
   - Referência exata: `create-user.use-case.ts` linhas 34–58 e `register.use-case.ts` linhas 50–66.

5. **Validação (validateCreateUser, validateCreateItem, validateRegister, validateLogin)**  
   - Criar um helper genérico em cada serviço, por exemplo `validateBody<T>(schema: z.ZodType<T>)` que retorne um middleware Express: `(req, res, next) => { const result = schema.safeParse(req.body); if (!result.success) { sendValidationError(res, result.error); return; } req.body = result.data; next(); }`. Assim reduz-se repetição entre user.validation, item.validation e auth.validation. Arquivos: `user.validation.ts`, `item.validation.ts`, `auth.validation.ts`.

6. **Payload UserCreated no catalog**  
   - Em `packages/catalog-service/src/infrastructure/messaging/rabbitmq-user-created.consumer.ts` (linha 39): em vez de `body.payload as UserCreatedPayload`, validar com Zod (ex.: schema em `@lframework/shared` ou em catalog para o payload) e, se inválido, logar e fazer nack. Assim evita-se cast e melhora-se robustez.

7. **Documentação ARCHITECTURE.md**  
   - Em cada serviço, na seção “Where to find things” ou nova subseção “DTOs e erros”:
     - Listar DTOs em application/dtos vs infrastructure/http/dtos; explicar que ResultDto é retorno de use case e ResponseDto é contrato HTTP.
     - Documentar que erros de aplicação são mapeados no controller para HTTP e que o formato de erro da API é sempre `{ error: string }` (ErrorResponseDto).

---

## (c) Resumo – o que está bom

- **SOLID:** Use cases e controllers com responsabilidade única; dependência em portas (inversão) e portas enxutas (interface segregation) bem aplicados; hierarquias de erro e adapters respeitam Liskov.
- **Tipagem:** Uso consistente de Zod como fonte de verdade nos DTOs de entrada e de `z.infer`; nenhum `any`; ErrorResponseDto alinhado entre serviços; apenas alguns casts localizados (principalmente em user.controller e em integrações externas).
- **Arquitetura e convenções:** Estrutura domain/application/infrastructure clara e consistente entre identity e catalog; nomenclatura ResultDto vs ResponseDto e sufixos .use-case.ts / .controller.ts / .dto.ts bem adotados; DTOs de aplicação vs HTTP (Health) separados por pasta.
- **Tratamento de erros:** Use cases lançam erros de domínio e controllers mapeiam para HTTP; formato único `{ error: string }` em todos os pontos; a única melhoria é unificar o **estilo** (sendError) e remover casts no user.controller.
- **Documentação prévia:** As revisões em `revisao-dtos-refatoracao.md` e `revisao-arquitetura-estrutura.md` já cobrem convenções e bugs; este documento complementa com foco em qualidade de código e refatorações concretas.
