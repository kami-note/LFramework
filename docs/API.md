# API — Gateway, endpoints e autenticação

Os serviços podem ser acessados **diretamente** (portas 3001 e 3002) ou **via API Gateway** (porta 8080, prefixos `/identity/` e `/catalog/`). Use o gateway como ponto único em produção ou desenvolvimento integrado.

---

## 1. API Gateway (Nginx)

| Componente | Descrição |
|------------|-----------|
| **Porta** | `GATEWAY_PORT` (default: 8080) |
| **Config** | `nginx/nginx.conf` |
| **Base** | `http://localhost:8080` |

### Rotas do gateway

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Health do gateway |
| Todas | `/identity/...` | Proxy para identity-service (3001) |
| Todas | `/catalog/...` | Proxy para catalog-service (3002) |

O Nginx remove o prefixo ao repassar: `GET /identity/api/users/123` → `GET /api/users/123` no identity.

### Exemplos (gateway)

```bash
curl http://localhost:8080/health
curl http://localhost:8080/identity/health
curl http://localhost:8080/catalog/health
curl -X POST http://localhost:8080/identity/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","name":"Nome","password":"senha12345"}'
curl http://localhost:8080/catalog/api/items
```

---

## 2. Identity Service (3001 ou `/identity/`)

### Health

- `GET /health` — health check

### Usuários (admin)

- `POST /api/users` — criar usuário. Body: `{ "email": "...", "name": "..." }`. Exige JWT + role admin.
- `GET /api/users/:id` — buscar usuário por ID. Exige JWT; só o próprio usuário ou admin.

### Autenticação

- `POST /api/auth/register` — registro (email, name, password). Senha mín. 8 caracteres.
- `POST /api/auth/login` — login. Body: `{ "email": "...", "password": "..." }`.
- `GET /api/auth/me` — usuário atual. Header: `Authorization: Bearer <token>`.
- `GET /api/auth/google` — inicia OAuth Google (redirect).
- `GET /api/auth/google/callback` — callback OAuth Google.
- `GET /api/auth/github` — inicia OAuth GitHub (redirect).
- `GET /api/auth/github/callback` — callback OAuth GitHub.

**Resposta de auth (register/login/OAuth):** `{ "user": { "id", "email", "name", "createdAt" }, "accessToken": "...", "expiresIn": "7d" }`.

**Variáveis de ambiente (identity):** `JWT_SECRET` (obrigatório em produção, min 32 chars), `JWT_EXPIRES_IN_SECONDS`, `BASE_URL` (para callbacks OAuth), `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`. Sem client OAuth, o endpoint correspondente retorna 503.

**Rate limiting:** register/login 20 req/15 min por IP; OAuth 30 req/15 min por IP. Resposta 429 ao exceder.

---

## 3. Catalog Service (3002 ou `/catalog/`)

- `GET /health` — health check
- `GET /api/items` — listar itens (com cache Redis)
- `POST /api/items` — criar item. Body: `{ "name": "...", "priceAmount": 100, "priceCurrency": "BRL" }`. Exige JWT. Moedas: BRL, USD, EUR; padrão BRL.

---

## 4. Formato de erro

Todas as respostas de erro seguem:

```json
{ "error": "string" }
```

O campo `error` traz a mensagem (ex.: "User not found", "Invalid email"). Em 500 o cliente recebe apenas "Internal server error". Detalhes em [DEVELOPMENT.md](DEVELOPMENT.md#7-troubleshooting).

---

## 5. Uso do token JWT

Rotas protegidas exigem:

```http
Authorization: Bearer <accessToken>
```

Identity e Catalog devem usar o **mesmo** `JWT_SECRET` quando um emite e o outro valida o token.
