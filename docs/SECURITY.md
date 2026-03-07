# Segurança — validação, limites e boas práticas

Este documento resume as medidas de validação e segurança aplicadas no LFramework e pontos de atenção (OWASP e configuração).

---

## 1. Validação e limites (já aplicados)

| Área | Regra | Onde |
|------|--------|------|
| **Nome (pessoa/item)** | Trim, min 1, max 200 caracteres. Sem emoji, sem `<` `>`. Padrão: letras, números, espaços, hífen, apóstrofo. | `@lframework/shared` `nameSchema`; identity (auth, create user), catalog (create item, consumer UserCreated). |
| **Email** | Trim, lowercase, max 254 (RFC), sem `<` `>`, formato válido. | identity: `emailSchema` em register/login/create user; catalog consumer (payload UserCreated). |
| **Senha** | Min 8, max 128 caracteres. | identity: register/login. |
| **Body JSON** | Limite 512kb. | `express.json({ limit: "512kb" })` em identity e catalog. |
| **priceAmount** | Número finito, não negativo, teto 999_999_999 (Int no DB). | catalog: create item. |
| **priceCurrency** | Apenas BRL, USD, EUR. | catalog: create item. |
| **Payload UserCreated (consumer)** | Catalog **não confia no publisher**: valida `userId` (1–64), `email`, `name` (mesmo padrão do nameSchema), `occurredAt` (ISO válido). | catalog: `rabbitmq-user-created.consumer.ts`. |
| **OAuth code/state** | Max 2048 caracteres. | identity: query schema OAuth callback. |

Essas regras evitam DoS por payload gigante, XSS (nome/email sem tags), overflow numérico e injeção em campos de texto.

---

## 2. Autenticação e autorização

- **Senhas:** hash com Argon2id (porta `IPasswordHasher`).
- **JWT:** assinado com `JWT_SECRET`; em produção o identity exige secret com pelo menos 32 caracteres.
- **OAuth:** fluxo authorization code; `state` validado no callback (Redis, TTL 10 min) para mitigar CSRF.
- **Controle de acesso:**
  - `GET /api/users/:id`: apenas o próprio usuário ou role admin pode ver o recurso.
  - `POST /api/users`: apenas role admin (middleware `requireRole('admin')`).
  - Catalog: `POST /api/items` exige JWT; `GET /api/items` pode ser público (decisão de negócio documentada).

Quem pode acessar o quê está descrito em [API.md](API.md).

---

## 3. Secrets e configuração

- Não usar fallbacks com credenciais no código em produção. Em produção (`NODE_ENV=production`), as URLs de banco (IDENTITY_DATABASE_URL, CATALOG_DATABASE_URL), Redis (REDIS_URL) e RabbitMQ (RABBITMQ_URL) devem vir **sempre** de variáveis de ambiente; os serviços fazem `process.exit(1)` se alguma estiver ausente e não usam string literal com credenciais.
- `JWT_SECRET`, connection strings e secrets OAuth vêm de variáveis de ambiente (`.env` não versionado).
- Em produção, usar secrets manager ou env injetado pelo orchestrator.

---

## 4. Logs e dados sensíveis

- Não logar PII (ex.: email) em texto claro; no consumer UserCreated, logar apenas identificador opaco (ex.: `userId`).
- RequestId nos headers/logs para correlacionar requisições sem expor dados do usuário.

---

## 5. Pontos de atenção (OWASP)

- **A01 Broken Access Control:** ownership e role já aplicados em GET/POST users e em POST items conforme descrito acima.
- **A03 Injection:** IDs (ex.: UUID) validados nos controllers; DTOs com Zod evitam tipos inesperados e tamanhos excessivos.
- **A07 Authentication Failures:** JWT com expiração, sem fallback de secret fraco em produção; OAuth com state. Logout/revogação: JWT válido até expirar (melhoria futura: blacklist ou token curto + refresh).

Para um checklist mais detalhado de riscos e patches, use este doc junto com revisões de código focadas em segurança.
