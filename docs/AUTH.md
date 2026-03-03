# Autenticação e OAuth

O **identity-service** oferece autenticação moderna e segura com:

- **Registro e login** por email/senha (hash com Argon2id, token JWT)
- **OAuth 2.0** com Google e GitHub (fluxo authorization code)

## Variáveis de ambiente

No `.env` (ou ambiente do identity-service):

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `JWT_SECRET` | Sim (produção) | Segredo para assinar/verificar JWTs. Em produção deve ter no mínimo 32 caracteres; o serviço não sobe sem ele. |
| `JWT_EXPIRES_IN_SECONDS` | Não | Validade do token em segundos (padrão: 604800 = 7 dias). A resposta da API usa esse valor em `expiresIn` (ex.: "7d"). |
| `BASE_URL` | Não | URL acessível pelo cliente para callbacks OAuth. **Direto:** `http://localhost:3001`. **Via gateway:** use a URL do gateway + prefixo do identity, ex.: `http://localhost:8080/identity` — no Google/GitHub a callback deve ser exatamente `{BASE_URL}/api/auth/google/callback` (ou `.../github/callback`). |
| `GOOGLE_CLIENT_ID` | Não | Ativa login com Google. Obtenha em [Google Cloud Console](https://console.cloud.google.com/apis/credentials). |
| `GOOGLE_CLIENT_SECRET` | Não | Secret do cliente OAuth Google. |
| `GITHUB_CLIENT_ID` | Não | Ativa login com GitHub. Obtenha em [GitHub Developer Settings](https://github.com/settings/developers). |
| `GITHUB_CLIENT_SECRET` | Não | Secret do cliente OAuth GitHub. |

Se `GOOGLE_*` ou `GITHUB_*` não forem definidos, os endpoints OAuth correspondentes retornam 503.

**Rate limiting:** `POST /auth/register` e `POST /auth/login` limitam por IP (20 req/15 min). As rotas OAuth (`GET /auth/google`, `/auth/google/callback`, `GET /auth/github`, `/auth/github/callback`) limitam por IP (30 req/15 min). Resposta 429 ao exceder.

## Endpoints

Base: **identity-service** em `http://localhost:3001` ou via gateway `http://localhost:8080/identity`.

### Registro (email/senha)

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "name": "Nome do Usuário",
  "password": "senhaSegura123"
}
```

- **Senha:** mínimo 8 caracteres.
- **Resposta 201:** `{ "user": { "id", "email", "name", "createdAt" }, "accessToken": "...", "expiresIn": "7d" }` (ou outro valor conforme `JWT_EXPIRES_IN_SECONDS`).
- **Erros:** 400 (email inválido ou senha curta), 409 (email já existe).

### Login (email/senha)

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "password": "senhaSegura123"
}
```

- **Resposta 200:** `{ "user": { "id", "email", "name" }, "accessToken": "...", "expiresIn": "7d" }`.
- **Erros:** 401 (credenciais inválidas).

### Usuário atual (protegido)

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

- **Resposta 200:** `{ "id", "email", "name", "createdAt" }`.
- **Erros:** 401 (token ausente/inválido/expirado), 404 (usuário não encontrado).

### OAuth Google

1. **Iniciar login:** `GET /api/auth/google`  
   Redireciona para a tela de consentimento do Google.

2. **Callback:** `GET /api/auth/google/callback?code=...&state=...`  
   O serviço valida o `state` (anti-CSRF, armazenado em Redis com TTL 10 min) e troca o `code` por um token, obtém o perfil e:
   - Se já existir vínculo OAuth → retorna usuário + `accessToken` (JSON).
   - Se o email já existir (conta local) → vincula a conta OAuth e retorna usuário + `accessToken`.
   - Se for novo → cria usuário, publica `user.created` e retorna usuário + `accessToken` e `isNewUser: true`.

**Callback URL configurada no Google:** `{BASE_URL}/api/auth/google/callback`  
Ex.: `http://localhost:3001/api/auth/google/callback`.

### OAuth GitHub

1. **Iniciar login:** `GET /api/auth/github`  
   Redireciona para autorização no GitHub.

2. **Callback:** `GET /api/auth/github/callback?code=...&state=...`  
   O serviço valida o `state` (anti-CSRF) e troca o `code` por token; mesmo fluxo que o Google (vínculo ou criação de usuário, retorno em JSON).

**Formato da resposta (Google e GitHub):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Nome",
    "createdAt": "2025-03-03T12:00:00.000Z",
    "isNewUser": true
  },
  "accessToken": "eyJ...",
  "expiresIn": "7d"
}
```

**Callback URL no GitHub:** `{BASE_URL}/api/auth/github/callback`.

## Uso do token

Envie o JWT no header em rotas protegidas:

```http
Authorization: Bearer <accessToken>
```

O middleware de auth valida o token e preenche `req.userId` e `req.userEmail` para uso em controllers.

## Segurança

- **Senhas:** hashing com **Argon2id** (porta `IPasswordHasher`).
- **Tokens:** JWT assinado com `JWT_SECRET`; em produção o serviço exige `JWT_SECRET` com pelo menos 32 caracteres e não usa fallback.
- **OAuth:** fluxo authorization code; **state** validado no callback (armazenado em Redis, TTL 10 min) para mitigar CSRF; tokens do provedor não são armazenados; apenas `provider` + `providerId` são persistidos.
- **Credenciais:** armazenadas em tabela separada (`auth_credentials`), um hash por usuário; registro persiste user + credential em **uma transação** (Prisma).
- **Rate limiting:** login e registro limitados por IP (20 req/15 min); rotas OAuth (redirect + callback Google/GitHub) limitadas por IP (30 req/15 min).

## Migração

Após adicionar auth, aplique a migration do identity-service:

```bash
pnpm --filter identity-service exec prisma migrate deploy
```

Ou, em desenvolvimento:

```bash
cd packages/identity-service && pnpm prisma migrate dev --name add_auth_and_oauth
```

Isso cria as tabelas `auth_credentials` e `oauth_accounts`.
