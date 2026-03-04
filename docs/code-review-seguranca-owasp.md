# Code review de segurança – LFramework (OWASP e boas práticas)

**Escopo:** A01, A02, A03, A07, dependências e secrets.  
**Data:** Março 2025.

---

## (a) Tabela de riscos por categoria

| # | Categoria OWASP / Área | Risco | Nível | Item OWASP |
|---|------------------------|-------|--------|------------|
| 1 | Controle de acesso     | IDOR em GET /api/users/:id – qualquer usuário autenticado pode ler outro usuário por ID | **Alto**  | A01:2021 Broken Access Control |
| 2 | Controle de acesso     | POST /api/users sem checagem de role – qualquer autenticado pode criar usuários (“admin” só no comentário) | **Alto**  | A01:2021 Broken Access Control |
| 3 | Controle de acesso     | GET/POST /api/items sem autenticação – listagem e criação abertas | **Médio** | A01:2021 Broken Access Control |
| 4 | Secrets / Config      | Fallbacks de connection strings com credenciais no código em produção | **Médio** | – |
| 5 | Autenticação          | Ausência de logout/revogação – JWT válido até expirar | **Médio** | A07:2021 Identification and Authentication Failures |
| 6 | Dados sensíveis       | Log de userId/email no catalog-service ao receber UserCreated | **Baixo** | A02 (vazamento em log) |
| 7 | Validação de entrada  | Parâmetro :id em GET /api/users/:id não validado como UUID | **Baixo** | A03 (consistência / abuso) |

---

## (b) Riscos: arquivo, trecho, descrição e recomendação

### 1) IDOR em GET /api/users/:id (A01 – Alto)

- **Arquivo:** `packages/identity-service/src/infrastructure/http/user.controller.ts` (método `getById`) e `packages/identity-service/src/application/use-cases/get-user-by-id.use-case.ts`.
- **Trecho:** O controller passa `req.params.id` ao use case; o use case busca por `id` sem comparar com o usuário autenticado (`req.userId`).
- **Descrição:** Qualquer usuário com um JWT válido pode obter dados de outro usuário (id, email, name, createdAt) alterando o `:id` na URL.
- **Recomendação:** Garantir que só o próprio usuário (ou um papel “admin”) possa ver o recurso.

**Patch sugerido (ownership – só o próprio usuário):**

No controller, após obter o usuário, checar ownership:

```ts
// user.controller.ts – getById
getById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (req.userId !== id) {
      res.status(403).json({ error: "Forbidden" } as ErrorResponseDto);
      return;
    }
    const user = await this.getUserByIdUseCase.execute(id);
    // ...
  }
};
```

Se no futuro houver role “admin”, usar algo como: `if (req.userId !== id && req.role !== 'admin') { ... }`.

---

### 2) POST /api/users sem checagem de role (A01 – Alto)

- **Arquivo:** `packages/identity-service/src/infrastructure/http/routes.ts` e comentário em `packages/identity-service/src/application/dtos/create-user.dto.ts`.
- **Trecho:** `router.post("/users", validateCreateUser, authMiddleware, controller.create);` – apenas exige JWT, não exige role.
- **Descrição:** O DTO diz “criação de usuário (admin)”, mas qualquer usuário autenticado pode criar novos usuários.
- **Recomendação:** Restringir POST /api/users a um papel de administrador (ou remover o endpoint público e criar um fluxo de registro separado).

**Mudança sugerida:**

1. Incluir no payload JWT um claim de role (ex.: `role: 'admin' | 'user'`) e preenchê-lo no login/registro/OAuth conforme regra de negócio.
2. Criar um middleware `requireRole('admin')` que, após o `authMiddleware`, verifica `req.role === 'admin'`.
3. Aplicar esse middleware na rota:  
   `router.post("/users", validateCreateUser, authMiddleware, requireRole('admin'), controller.create);`
4. Se o modelo for “apenas auto-registro”, considerar remover POST /api/users ou deixá-lo apenas para um serviço interno/admin com outro mecanismo de auth.

---

### 3) GET/POST /api/items sem autenticação (A01 – Médio)

- **Arquivo:** `packages/catalog-service/src/infrastructure/http/routes.ts` e `item.controller.ts`.
- **Trecho:** `router.post("/items", validateCreateItem, controller.create);` e `router.get("/items", controller.list);` – sem middleware de autenticação.
- **Descrição:** Qualquer cliente pode listar e criar itens. Pode ser intencional (API pública de catálogo), mas é um risco de controle de acesso se a intenção for restringir criação ou listagem.
- **Recomendação:**  
  - Se a criação deve ser restrita: exigir JWT (ou API key) em POST /api/items e, se aplicável, validar ownership/role.  
  - Se a listagem for pública: manter GET sem auth e documentar; proteger apenas POST.  
  - Em todos os casos, documentar no README/ARCHITECTURE quem pode acessar o quê.

---

### 4) Fallbacks de connection strings com credenciais no código (Secrets – Médio)

- **Arquivo:** `packages/identity-service/src/index.ts` (linhas 7–9) e `packages/catalog-service/src/index.ts` (linhas 6–11).
- **Trecho (identity):**  
  `const databaseUrl = process.env.IDENTITY_DATABASE_URL ?? "postgresql://lframework:lframework@...";`  
  Idem para `redisUrl` e `rabbitmqUrl`. Em produção só há checagem para `JWT_SECRET`.
- **Descrição:** Se `NODE_ENV=production` mas `IDENTITY_DATABASE_URL` (ou Redis/RabbitMQ) não for definido, o serviço sobe com credenciais padrão embutidas no código.
- **Recomendação:** Em produção, não usar fallbacks com credenciais. Falhar na subida se variáveis obrigatórias estiverem ausentes.

**Patch sugerido (identity-service):**

```ts
// index.ts – após definir isProduction
const databaseUrl = process.env.IDENTITY_DATABASE_URL ?? (isProduction ? "" : "postgresql://lframework:lframework@localhost:5432/lframework_identity");
const redisUrl = process.env.REDIS_URL ?? (isProduction ? "" : "redis://localhost:6379");
const rabbitmqUrl = process.env.RABBITMQ_URL ?? (isProduction ? "" : "amqp://lframework:lframework@localhost:5672");

if (isProduction) {
  if (!databaseUrl || !redisUrl || !rabbitmqUrl) {
    console.error("In production, IDENTITY_DATABASE_URL, REDIS_URL and RABBITMQ_URL must be set");
    process.exit(1);
  }
}
```

Aplicar lógica equivalente no catalog-service para `CATALOG_DATABASE_URL`, `REDIS_URL` e `RABBITMQ_URL`.

---

### 5) Ausência de logout/revogação de token (A07 – Médio)

- **Arquivo:** Rotas de auth em `packages/identity-service/src/infrastructure/http/auth.routes.ts`; não existe endpoint de logout.
- **Descrição:** JWT é stateless; não há blacklist nem revogação. Um token roubado continua válido até expirar (ex.: 7 dias).
- **Recomendação:**  
  - **Curto prazo:** Documentar que “logout” é apenas remoção do token no cliente; considerar reduzir `JWT_EXPIRES_IN_SECONDS` ou usar refresh tokens com vida curta.  
  - **Médio prazo (opcional):** Implementar blacklist no Redis: no logout, guardar o jti (ou o token até expirar) em uma chave com TTL igual ao tempo restante do token; no `authMiddleware`, antes de aceitar o token, checar se não está na blacklist.

---

### 6) Log de dados pessoais no catalog-service (A02 – Baixo)

- **Arquivo:** `packages/catalog-service/src/index.ts`, callback de UserCreated.
- **Trecho:** `console.log("[Catalog] UserCreated received:", payload.userId, payload.email);`
- **Descrição:** userId e email são PII; em ambientes com coleta centralizada de logs isso pode aumentar risco de vazamento ou não conformidade (ex.: LGPD).
- **Recomendação:** Remover ou restringir a ambientes não produtivos. Em produção, logar apenas identificador opaco (ex.: `payload.userId` sem email) ou nível debug desativado por padrão.

---

### 7) Parâmetro :id não validado como UUID (A03 – Baixo)

- **Arquivo:** `packages/identity-service/src/infrastructure/http/user.controller.ts` – `const { id } = req.params;`
- **Descrição:** O id é repassado direto ao Prisma. Não há injeção (Prisma usa parâmetros), mas aceitar qualquer string pode facilitar enumeração ou comportamento inesperado.
- **Recomendação:** Validar formato UUID antes de chamar o use case (ex.: Zod com `z.string().uuid()`). Em caso de formato inválido, responder 400 em vez de 404.

---

## (c) O que já está OK (não repetir trabalho)

- **A01 / A07 – Autenticação e rotas protegidas:**  
  - POST e GET /api/users exigem `authMiddleware` (JWT).  
  - Rate limit em login/registro (20 req/15 min) e em fluxos OAuth (30 req/15 min).  
  - CORS no identity-service só aplicado quando `CORS_ORIGIN` está definido (evita abrir para * por padrão).  
  - OAuth: state aleatório (16 bytes), armazenado no cache com TTL, validado no callback e removido após uso (proteção contra CSRF no fluxo OAuth).

- **A02 – Criptografia e dados sensíveis:**  
  - Senhas com Argon2id.  
  - JWT com HS256 e lista explícita de algoritmos na verificação (`algorithms: ["HS256"]`), evitando “algorithm confusion”.  
  - Em produção, JWT_SECRET obrigatório e com tamanho mínimo 32 caracteres.  
  - Respostas de auth não incluem senha; UserResponseDto só expõe id, email, name, createdAt.

- **A03 – Injeção e validação:**  
  - Entrada de body validada com Zod em register, login, create user, create item e query de OAuth callback.  
  - Nenhum uso de `$queryRaw`/`$executeRaw` no Prisma; apenas API type-safe (findUnique, findMany, upsert).  
  - Resposta de erro de validação envia mensagem genérica (primeiro erro de campo), sem vazar stack ou detalhes internos.

- **Secrets e env:**  
  - `.env` está no `.gitignore`.  
  - `.env.example` contém apenas placeholders/valores de desenvolvimento, sem credenciais reais.  
  - JWT e OAuth usam variáveis de ambiente sem fallback de credenciais em produção (apenas JWT_SECRET é validado hoje; ver risco 4).

- **Dependências:**  
  - `pnpm audit` sem vulnerabilidades conhecidas.  
  - Lockfile (pnpm-lock.yaml) fixa versões exatas; uso de ranges (^) no package.json é esperado e o lockfile garante builds reproduzíveis.

---

## Resumo executivo

- **Alto:** Corrigir IDOR em GET /api/users/:id e restringir POST /api/users (role admin ou remoção do endpoint).  
- **Médio:** Definir política de acesso para /api/items; remover fallbacks de connection strings em produção; considerar logout/blacklist e documentar.  
- **Baixo:** Reduzir PII em logs no catalog; validar UUID em GET /api/users/:id.

Com as correções de itens altos e médios, o projeto fica alinhado às recomendações OWASP e boas práticas cobradas no escopo do review.
