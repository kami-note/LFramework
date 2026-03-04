# Code review: Testes e Documentação — LFramework

Foco em **resultado prático**: pirâmide de testes, documentação de API, erros/runbook e logging/observabilidade.

---

## 1) Testes

### Estado atual

- **Nenhum teste encontrado**: não há `*.spec.ts`, `*.test.ts` nem diretórios `__tests__`.
- **Nenhuma ferramenta de teste** no monorepo: Jest/Vitest/Mocha não constam em nenhum `package.json`.
- Use cases e controllers existem e estão preparados para injeção (ports/repositórios), o que facilita testes unitários com mocks.

### Pirâmide desejada

| Camada | Situação | Prioridade |
|--------|----------|------------|
| **Unitários (use cases + mocks)** | Não existem | Alta — base da pirâmide |
| **Integração (HTTP, DB)** | Não existem | Média — após unitários estáveis |
| **E2E (gateway + serviços)** | Não existem | Baixa — smoke/regressão |

### Ordem sugerida de implementação

1. **Use cases do identity-service** (CreateUser, Register, Login, GetUserById, GetCurrentUser) com repositório/cache/eventPublisher mockados — maior valor e já existem erros de domínio (`UserAlreadyExistsError`, `InvalidEmailError`, etc.).
2. **Use cases do catalog-service** (CreateItem, ListItems) com repositório mockado.
3. **Controllers** (opcional): testes de integração HTTP que chamam o Express com use case mockado, checando status e corpo.
4. **Validação Zod**: testes unitários dos schemas (createUserSchema, registerSchema, createItemSchema) com casos válidos e inválidos.
5. **Integração com DB**: testes que sobem Prisma contra DB de teste (ex.: SQLite ou Postgres efêmero) para repositórios ou fluxos críticos.
6. **E2E**: smoke via gateway (health, um POST/GET por serviço) se necessário.

### Ferramenta e localização

- **Ferramenta:** **Vitest** — rápido, compatível com Jest, bom suporte a TypeScript e ESM no monorepo.
- **Onde colocar:** `*.spec.ts` **ao lado do arquivo** (ex.: `create-user.use-case.spec.ts` na mesma pasta do use case). Alternativa: `__tests__/` por pacote (ex.: `packages/identity-service/src/application/use-cases/__tests__/create-user.use-case.spec.ts`). Recomendação: **ao lado** para manter cobertura visível e imports simples.

### Exemplo concreto: CreateUserUseCase com repositório mock e UserAlreadyExistsError

**Arquivo:** `packages/identity-service/src/application/use-cases/create-user.use-case.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateUserUseCase } from "./create-user.use-case";
import type { IUserRepository } from "../../../domain/repository-interfaces/user-repository.interface";
import type { ICacheService } from "@lframework/shared";
import type { IEventPublisher } from "../../ports/event-publisher.port";
import { UserAlreadyExistsError, InvalidEmailError } from "../../errors";
import type { CreateUserDto } from "../../dtos/create-user.dto";

describe("CreateUserUseCase", () => {
  let useCase: CreateUserUseCase;
  let mockUserRepo: IUserRepository;
  let mockCache: ICacheService;
  let mockEventPublisher: IEventPublisher;

  beforeEach(() => {
    mockUserRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByEmail: vi.fn().mockResolvedValue(null),
    };
    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    };
    mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new CreateUserUseCase(mockUserRepo, mockCache, mockEventPublisher);
  });

  it("deve lançar InvalidEmailError quando email é inválido", async () => {
    const dto: CreateUserDto = { email: "invalid", name: "Test" };
    await expect(useCase.execute(dto)).rejects.toThrow(InvalidEmailError);
    await expect(useCase.execute(dto)).rejects.toThrow("Invalid email");
    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });

  it("deve lançar UserAlreadyExistsError quando email já existe", async () => {
    const dto: CreateUserDto = { email: "existing@example.com", name: "Test" };
    const existingUser = {
      id: "existing-id",
      email: { value: "existing@example.com" },
      name: "Existing",
      createdAt: new Date(),
    } as any;
    vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(existingUser);

    await expect(useCase.execute(dto)).rejects.toThrow(UserAlreadyExistsError);
    await expect(useCase.execute(dto)).rejects.toThrow("User with this email already exists");
    expect(mockUserRepo.save).not.toHaveBeenCalled();
    expect(mockEventPublisher.publish).not.toHaveBeenCalled();
  });

  it("deve criar usuário, publicar evento e preencher cache quando dados são válidos", async () => {
    const dto: CreateUserDto = { email: "new@example.com", name: "New User" };
    const result = await useCase.execute(dto);

    expect(result.email).toBe("new@example.com");
    expect(result.name).toBe("New User");
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(mockUserRepo.findByEmail).toHaveBeenCalledWith("new@example.com");
    expect(mockUserRepo.save).toHaveBeenCalledTimes(1);
    expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^user:/),
      expect.objectContaining({ email: "new@example.com", name: "New User" }),
      300
    );
  });
});
```

**Configuração mínima (root ou por pacote):** adicionar em `packages/identity-service/package.json` (ou criar `vitest.config.ts`):

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
},
"devDependencies": {
  "vitest": "^2.0.0"
}
```

E em `packages/identity-service/vitest.config.ts` (ou no root com workspaces):

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@lframework/shared": path.resolve(__dirname, "../shared/src"),
    },
  },
});
```

---

## 2) Documentação de API

### Estado atual

- **Não existe OpenAPI/Swagger** (nenhum `openapi.yaml`, `swagger.json` ou equivalente).
- Endpoints estão documentados em **prosa** em:
  - `README.md` (lista resumida)
  - `docs/API-GATEWAY.md` (tabelas + cURL)
  - `docs/AUTH.md` (registro, login, OAuth, códigos de erro por endpoint)

### Endpoints que devem constar no spec (Identity + Catalog)

**Identity (base `/api` no serviço; no gateway: `/identity/`):**

| Método | Path | Descrição |
|--------|------|-----------|
| POST | /api/users | Criar usuário (admin) |
| GET | /api/users/:id | Buscar usuário por ID |
| POST | /api/auth/register | Registro email/senha |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Usuário atual (Bearer) |
| GET | /api/auth/google | Redirect OAuth Google |
| GET | /api/auth/google/callback | Callback Google |
| GET | /api/auth/github | Redirect OAuth GitHub |
| GET | /api/auth/github/callback | Callback GitHub |
| GET | /health | Health check |

**Catalog (base `/api` no serviço; no gateway: `/catalog/`):**

| Método | Path | Descrição |
|--------|------|-----------|
| POST | /api/items | Criar item |
| GET | /api/items | Listar itens |
| GET | /health | Health check |

### Contrato de erro recomendado

Todos os erros HTTP devem responder com **um único formato**:

- **Body:** `{ "error": string }` (mensagem legível para cliente).
- **Códigos:**  
  - **400** — validação (Zod) ou regra de negócio (ex.: email inválido, senha curta).  
  - **401** — token ausente/inválido/expirado ou credenciais inválidas.  
  - **404** — recurso não encontrado (ex.: usuário por id).  
  - **409** — conflito (ex.: email já existe).  
  - **429** — rate limit (Too many attempts).  
  - **500** — erro interno (mensagem genérica "Internal server error").  
  - **503** — OAuth não configurado.

O projeto já usa `ErrorResponseDto = { error: string }` e envia 400/401/404/409/500 (e 503 no auth); falta apenas **formalizar e documentar** esse contrato no spec.

### Estrutura mínima do spec OpenAPI (sugestão)

- **openapi:** 3.0.3 (ou 3.1).
- **info:** title (LFramework API), version, description.
- **servers:**  
  - direto: `http://localhost:3001` (identity), `http://localhost:3002` (catalog);  
  - gateway: `http://localhost:8080/identity`, `http://localhost:8080/catalog`.
- **paths:** um path por endpoint (ex.: `POST /api/users`, `GET /api/users/{id}`).
- Por path:
  - **requestBody** onde houver body (content-type `application/json`, schema com propriedades e exemplos).
  - **parameters** para path/query (ex.: `id`, `code`, `state` em callbacks).
  - **responses:** 200/201 (schema do sucesso), 400, 401, 404, 409, 429, 500, 503 com:
    - `content.application/json.schema`: `{ "type": "object", "required": ["error"], "properties": { "error": { "type": "string" } } }`.
  - **security:** onde for Bearer (ex.: `/api/users/{id}`, `/api/auth/me`).
- **components.schemas:** reutilizar User, AuthResponse, Item, Error (error: string).
- **components.securitySchemes:** Bearer JWT.

Arquivo sugerido: `docs/openapi.yaml` (ou `openapi.yaml` na raiz), com tags `identity` e `catalog` para separar visualmente.

---

## 3) Documentação de erros e runbook

### Estado atual

- **AUTH.md** descreve bem os erros por endpoint (400, 401, 404, 409, 503, 429) e o formato de resposta de sucesso (user + accessToken + expiresIn).
- **README** e **API-GATEWAY** não explicam o **formato padrão de erro** (`{ "error": string }`) nem um guia de troubleshooting.
- Não há seção dedicada a “o que um dev precisa saber para debugar 401/409/500”.

### O que um dev precisa saber

- **401:** token ausente, malformado ou expirado; ou credenciais de login incorretas. Verificar header `Authorization: Bearer <token>` e validade do JWT; em login, conferir email/senha e se a conta existe.
- **409:** geralmente “email já existe” (registro ou create user). Verificar unicidade no banco.
- **500:** erro não mapeado no controller; em produção a mensagem deve ser genérica. Para debugar: logs do serviço (hoje só `console.error` em poucos pontos) e stack trace em ambiente de dev.

### Recomendações

- **Uma seção “Troubleshooting” ou “Erros comuns”** faz sentido, por exemplo em `docs/README.md` ou em um `docs/TROUBLESHOOTING.md` referenciado pelo README principal.
- Conteúdo sugerido:
  - Formato padrão de erro: `{ "error": string }`.
  - Tabela resumida: código HTTP → causa provável → onde olhar (header, body, logs).
  - 401: checklist (Bearer, expiração, login).
  - 409: email duplicado, onde verificar (DB, fluxo de registro).
  - 500: mensagem genérica; orientar a checar logs do serviço e, em dev, stack no console.
- **README principal:** um parágrafo curto (“Respostas de erro seguem o formato `{ "error": "..." }`; ver [Troubleshooting](docs/TROUBLESHOOTING.md) para códigos e dicas de debug.”) com link para essa seção.

---

## 4) Logging e observabilidade

### Estado atual

- **Uso de console:**  
  - `console.log`: startup (identity e catalog), consumo de evento UserCreated (catalog).  
  - `console.error`: bootstrap falhou (ambos), JWT_SECRET inválido em produção (identity), falha no callback OAuth (auth.controller), erro ao processar UserCreated (rabbitmq-user-created.consumer).
- **Não há:** logger estruturado (Pino/Winston), requestId, log explícito **antes** de responder 500 nos controllers.
- **Middleware de erro global no Express:** **não existe**. Cada controller faz `try/catch` e chama `res.status(...).json(...)`. Não há `app.use((err, req, res, next) => { ... })` para capturar erros não tratados ou repassados com `next(err)`.

### Recomendações

1. **Introduzir logger estruturado (ex.: Pino)** em ambos os serviços: substituir `console.log`/`console.error` por `logger.info`/`logger.error`, com suporte a campos adicionais (ex.: `userId`, `path`, `statusCode`).
2. **RequestId:** middleware que gera ou propaga `requestId` (UUID) por request e o inclui em todos os logs e, opcionalmente, no header de resposta (ex.: `X-Request-Id`), para rastrear uma requisição nos logs.
3. **Log em 500 antes de responder:** em todo catch que resulta em 500, registrar `logger.error({ err, requestId, path, method }, "Unhandled error")` antes de `res.status(500).json({ error: "Internal server error" })`.
4. **Middleware de erro global:**  
   - Registrar um handler de 4 argumentos: `(err, req, res, next)`.  
   - Dentro: logar o erro (com requestId se houver), responder com 500 e `{ error: "Internal server error" }` quando `res.headersSent` for false.  
   - Garantir que rotas/controllers que falham repassem o erro com `next(err)` em vez de fazer catch e 500 manual em todo lugar (opcional, mas centraliza log e resposta).
5. **Evitar vazar detalhes em produção:** em 500, não enviar `err.message` nem stack no body; usar o log para isso.

---

## Entregáveis resumidos

### (a) Plano de testes (tópicos + prioridade + exemplo)

- **Prioridade 1:** Testes unitários dos use cases (identity depois catalog) com mocks (repositório, cache, eventPublisher). Exemplo dado: **CreateUserUseCase** com `InvalidEmailError`, `UserAlreadyExistsError` e fluxo de sucesso (repositório mock, Vitest).
- **Prioridade 2:** Use cases do catalog (CreateItem, ListItems) e, em seguida, validação Zod (schemas).
- **Prioridade 3:** Controllers (integração HTTP com use case mockado) e integração com DB (Prisma + DB de teste).
- **Prioridade 4:** E2E via gateway (health + um fluxo por serviço).
- **Ferramenta:** Vitest. **Local:** `*.spec.ts` ao lado do arquivo (recomendado) ou `__tests__/` por pacote.

### (b) Checklist do que falta na doc de API (OpenAPI + contrato de erros)

- [ ] Criar spec OpenAPI (ex.: `docs/openapi.yaml`) com todos os paths listados acima (identity + catalog).
- [ ] Documentar para cada path: requestBody (quando houver), parameters, responses 2xx e 4xx/5xx.
- [ ] Padronizar respostas de erro no spec: `400, 401, 404, 409, 429, 500, 503` com schema `{ "error": "string" }`.
- [ ] Incluir security (Bearer JWT) nos paths protegidos e `components.securitySchemes`.
- [ ] Referenciar o spec no README ou em API-GATEWAY.md (link para o YAML ou para uma UI tipo Swagger UI/Redoc).

### (c) 3–5 ações concretas para doc e logging

1. **Doc:** Criar `docs/TROUBLESHOOTING.md` (ou seção equivalente) com formato de erro `{ "error": string }`, tabela código → causa → onde olhar, e dicas para 401/409/500; linkar no README.
2. **Doc:** Adicionar no README um parágrafo sobre “Respostas de erro” e link para Troubleshooting (e, quando existir, para o OpenAPI).
3. **Logging:** Introduzir Pino (ou Winston) nos dois serviços e substituir todos os `console.log`/`console.error` por logger estruturado.
4. **Logging:** Adicionar middleware de requestId e incluir requestId em todos os logs e, se possível, no header `X-Request-Id`.
5. **Logging:** Implementar middleware de erro global no Express (handler de 4 argumentos), logar todo 500 com requestId/path/method antes de responder, e garantir que em 500 a resposta seja sempre `{ "error": "Internal server error" }` sem vazar detalhes no body.

---

*Documento gerado a partir do code review do repositório LFramework (testes, documentação de API, erros/runbook e logging/observabilidade).*
