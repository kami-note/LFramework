# Revisão de código: refatoração de DTOs (identity-service e catalog-service)

## (a) Resumo executivo

A padronização de DTOs na camada HTTP e application está em bom caminho: use cases retornam DTOs tipados, controllers e middlewares usam `ErrorResponseDto` e respostas estruturadas. Há, porém, **inconsistências de localização** (ErrorResponseDto/HealthResponseDto entre application e infrastructure), **nomenclatura mista** (ResultDto nos use cases vs ResponseDto nos DTOs), **um possível bug de mensagem em 500** no `user.controller` e **documentação de arquitetura desatualizada**. Recomenda-se unificar convenções, corrigir o tratamento de erro 500 no user controller, documentar `createdAt` opcional em auth e atualizar os ARCHITECTURE.md.

---

## (b) Consistência e convenções

### 1. Onde ficam os DTOs: application vs infrastructure

| DTO | identity-service | catalog-service |
|-----|------------------|-----------------|
| ErrorResponseDto | `application/dtos/` | `application/dtos/` |
| HealthResponseDto | `infrastructure/http/dtos/` | `infrastructure/http/dtos/` |
| AuthResponseDto, OAuth DTOs | `application/dtos/` | N/A |

**Conclusão:** Não há critério explícito. Hoje:
- **Application:** DTOs que fazem parte do contrato da aplicação (entrada/saída de use cases, erros de regra).
- **Infrastructure:** Health está em infra em ambos (rota `/health` é detalhe de entrega HTTP).

**Recomendação:** Padronizar com uma regra clara e documentá-la no ARCHITECTURE.md, por exemplo:
- **`application/dtos/`:** DTOs de entrada/saída de use cases, erros de aplicação (`ErrorResponseDto`), respostas de auth/OAuth (contrato de domínio de aplicação).
- **`infrastructure/http/dtos/`:** DTOs puramente HTTP que não são retorno de use case (ex.: `HealthResponseDto`). Opcional: mover `ErrorResponseDto` para um shared ou manter em application por ser usado por use cases/erros de aplicação.

Se a decisão for “tudo que a API devolve é contrato da aplicação”, mover `HealthResponseDto` para `application/dtos/` em ambos os serviços e importar de lá no `index.ts` e em rotas.

### 2. Nomenclatura: sufixo Dto, ResultDto vs ResponseDto

- **Sufixo `Dto`:** Consistente em todos os DTOs.
- **ResultDto vs ResponseDto:**
  - **ResponseDto:** usado em DTOs de resposta HTTP (AuthResponseDto, UserResponseDto, ItemResponseDto, ErrorResponseDto, HealthResponseDto, OAuthCallbackResponseDto). Consistente.
  - **ResultDto:** usado **dentro dos use cases** como tipo de retorno: `LoginResultDto`, `RegisterResultDto`, `OAuthCallbackResultDto` (este último é `Omit<OAuthCallbackResponseDto, "expiresIn">`).

**Conclusão:** A distinção faz sentido: “Result” = retorno do use case (pode não ter tudo que a API adiciona, ex. `expiresIn`); “Response” = formato exposto na API. Está consistente entre os dois serviços para os DTOs de resposta; catalog-service não tem ResultDto porque os use cases retornam diretamente `ItemResponseDto` / `UserResponseDto`.

**Recomendação:** Manter. Opcional: documentar no ARCHITECTURE.md que “ResultDto” é tipo interno de retorno de use case e “ResponseDto” é contrato de resposta HTTP.

---

## (c) Possíveis bugs e regressões

### 1. [Média] user.controller create — 500 sempre "Internal server error"

**Arquivo:** `packages/identity-service/src/infrastructure/http/user.controller.ts`

```typescript
} catch (err) {
  const errorBody: ErrorResponseDto = { error: err instanceof Error ? err.message : "Internal server error" };
  if (err instanceof UserAlreadyExistsError) {
    res.status(409).json(errorBody);
    return;
  }
  if (err instanceof InvalidEmailError) {
    res.status(400).json(errorBody);
    return;
  }
  res.status(500).json({ error: "Internal server error" } as ErrorResponseDto);  // ← sempre mensagem fixa
}
```

Nos branches 409 e 400 usa-se `errorBody` (com `err.message`). No 500 usa-se mensagem fixa, o que é **correto** do ponto de vista de segurança (não vazar detalhes internos). Porém, **inconsistência de estilo**: no 500 não se reutiliza um `errorBody` e faz-se cast. Se a intenção for sempre mensagem genérica em 500, está correto; o que sobra é alinhar o estilo (por exemplo usar uma função `sendError` como no auth.controller) e evitar cast.

**Recomendação:** Considerar extrair `sendError(res, status, message)` (como no auth.controller) e no 500 chamar `sendError(res, 500, "Internal server error")`. Assim o tipo `ErrorResponseDto` fica centralizado e não é necessário cast.

### 2. [Baixa] OAuth callback — query.code e query.state após safeParse

**Arquivo:** `packages/identity-service/src/infrastructure/http/auth.controller.ts`

Após `oauthCallbackQuerySchema.safeParse({ code, state })`, em caso de sucesso `parsed.data` é `OAuthCallbackQueryDto` com `code` e `state` como `string`. O uso de `query.code` em `oauthCallbackUseCase.execute(query.code, ...)` está tipado e correto. A normalização `Array.isArray(req.query.code) ? req.query.code[0] : req.query.code` cobre query string em array; valores `undefined` ou ausentes são rejeitados pelo Zod (`z.string().min(1)`). **Não há bug.** Opcional: tratar explicitamente `null` (ex.: `?? undefined`) antes do parse se o tipo de `req.query` em runtime puder trazer `null`.

### 3. [Informativo] CreateItemUseCase / CreateUserUseCase — formato de createdAt (ISO)

**Arquivos:**  
`create-item.use-case.ts`, `create-user.use-case.ts`, `get-user-by-id.use-case.ts`, `list-items.use-case.ts`

Todos retornam `createdAt` como `user.createdAt.toISOString()` ou `item.createdAt.toISOString()`. O cache em `GetUserByIdUseCase` e `CreateUserUseCase` grava o mesmo formato. **Formato ISO está consistente.** Nenhuma regressão identificada.

---

## (d) Tipos e contratos

### 1. AuthUserDto com createdAt opcional

**Arquivo:** `packages/identity-service/src/application/dtos/auth-response.dto.ts`

Comentário atual: *"User subset in auth responses (login pode omitir createdAt)."*

- **Login:** use case retorna `user` sem `createdAt` (apenas id, email, name). Condiz com o DTO.
- **Register:** use case retorna `user` com `createdAt`. Também condiz.

**Recomendação:** O comentário já documenta. Para consumidores da API, vale explicitar no ARCHITECTURE.md ou em um doc de API que em **login** o campo `user.createdAt` pode vir omitido e em **register** (e possivelmente em **me**) vem preenchido. Opcional: adicionar um comentário JSDoc no tipo `AuthUserDto` com `@remarks` para login vs register.

### 2. UserResponseDto (createdAt obrigatório) vs AuthUserDto (createdAt opcional)

- **UserResponseDto:** usado em GET /users/:id, GET /me (get-current-user), create user (API interna). Sempre com `createdAt`.
- **AuthUserDto:** usado em login/register/OAuth; em login sem `createdAt`.

Unificar em um único tipo tornaria `createdAt` opcional em todos os lugares e obrigaria clientes de GET /users/:id e /me a sempre checar `createdAt`. **Recomendação:** Manter os dois tipos; a duplicação é aceitável e reflete contratos diferentes (auth vs recurso user). Opcional: extrair base comum com tipo auxiliar, por exemplo `UserFieldsDto` com `createdAt?: string`, e estender em `AuthUserDto` e `UserResponseDto` (com `createdAt` obrigatório onde fizer sentido).

### 3. OAuthCallbackQueryDto — edge cases

Zod com `z.string().min(1)` rejeita `undefined`, `null` e string vazia. A normalização array vs string cobre Express. **Recomendação:** Opcionalmente normalizar `null` para `undefined` antes do parse, e.g. `const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code ?? undefined;` (e idem para `state`) para deixar o contrato explícito.

---

## (e) Camada application vs infrastructure

### 1. ErrorResponseDto e HealthResponseDto — localização

- **ErrorResponseDto:** em `application/dtos/` em ambos os serviços. Usado por controllers, middleware e `validation-response`. Faz sentido por representar erro de aplicação/API.
- **HealthResponseDto:** em `infrastructure/http/dtos/` em ambos. Usado apenas na rota `/health` em `index.ts`.

**Recomendação:** Manter ErrorResponseDto em application. Para HealthResponseDto: ou (1) manter em infrastructure por ser detalhe HTTP, ou (2) mover para application/dtos e documentar que “respostas HTTP de aplicação” ficam em application. O que for escolhido, deixar explícito no ARCHITECTURE.md.

### 2. sendError e sendValidationError — uso de ErrorResponseDto

- **auth.controller:** usa função local `sendError(res, status, message)` que monta `ErrorResponseDto`. Correto.
- **user.controller:** monta `ErrorResponseDto` inline (e em um branch com cast). Tipo usado corretamente; apenas estilo inconsistente.
- **auth.middleware:** monta `ErrorResponseDto` inline. Correto.
- **validation-response.ts (ambos):** `sendValidationError` usa `ErrorResponseDto`. Correto.
- **item.controller:** monta `ErrorResponseDto` inline. Correto.

Todos os branches que enviam erro usam o formato `{ error: string }`. Nenhum bug de tipo identificado.

---

## (f) Documentação e arquitetura

### 1. ARCHITECTURE.md — DTOs e localização

**Arquivos:**  
`packages/identity-service/docs/ARCHITECTURE.md`,  
`packages/catalog-service/docs/ARCHITECTURE.md`

Hoje a tabela diz apenas que DTOs e validação ficam em `src/application/dtos/` e que middlewares importam schemas dos DTOs. Não mencionam:
- ErrorResponseDto, HealthResponseDto, AuthResponseDto, OAuth DTOs;
- Onde fica cada um (application vs infrastructure/http/dtos).

**Recomendação:** Em cada ARCHITECTURE.md, na seção “Where to find things” (ou nova subseção “DTOs”):
- Listar DTOs de resposta (AuthResponseDto, UserResponseDto, ErrorResponseDto, OAuthCallbackResponseDto, etc.) e dizer que ficam em `application/dtos/`.
- Dizer que HealthResponseDto fica em `infrastructure/http/dtos/` (ou em application/dtos, se for movido).
- Mencionar que ResultDto (LoginResultDto, RegisterResultDto, etc.) são tipos de retorno de use case, não expostos diretamente na API.

### 2. Comentários nos DTOs

O comentário em AuthUserDto (“login pode omitir createdAt”) é suficiente para quem lê o código. Para consumidores da API, complementar na documentação da API (ou ARCHITECTURE) é recomendado.

---

## (g) Melhorias opcionais

1. **Extrair sendError para util compartilhado (identity-service)**  
   Criar por exemplo `infrastructure/http/utils/send-error.ts` com `sendError(res, status, message)` e usar em auth.controller e user.controller. Reduz duplicação e centraliza o uso de `ErrorResponseDto`, evitando cast.

2. **Barrel export em application/dtos**  
   Criar `application/dtos/index.ts` reexportando os DTOs (e schemas Zod quando existirem) para imports mais limpos, e.g. `import type { ErrorResponseDto, AuthResponseDto } from "../../application/dtos"`. Opcional: fazer o mesmo em `infrastructure/http/dtos` se surgirem mais DTOs lá.

3. **Documentar convenção ResultDto vs ResponseDto**  
   Uma linha no ARCHITECTURE.md ou em um CONTRIBUTING.md já deixa a convenção explícita para novos DTOs.

---

## Resumo das ações sugeridas

| Prioridade | Ação |
|-----------|------|
| Alta | Documentar no ARCHITECTURE.md (ambos serviços) onde ficam ErrorResponseDto, HealthResponseDto, AuthResponseDto, OAuth DTOs e a convenção application vs infrastructure. |
| Média | Alinhar user.controller ao uso de sendError (extrair util e usar em 500) para consistência e tipo seguro. |
| Baixa | Decidir e documentar localização de HealthResponseDto (manter em infra ou mover para application). |
| Opcional | Barrel export em application/dtos; comentário/JSDoc sobre login omitir createdAt para consumidores da API; normalizar null em OAuth query. |
