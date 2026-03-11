# .env files – repeated information analysis

## Files

| File | Purpose |
|------|---------|
| **Root** `.env.example` | Full stack (Postgres, Redis, RabbitMQ, both services, api-docs, gateway) |
| **Root** `.env` | Local overrides (actual values, may omit some) |
| **identity-service** `.env.example` / `.env` | Identity-only subset; used when running that package in isolation |
| **catalog-service** `.env.example` | Catalog-only subset |

---

## Repeated variables (duplication)

### 1. Redis
- **Variable:** `REDIS_URL=redis://localhost:6379`
- **Present in:** root `.env.example`, root `.env`, identity-service (both), catalog-service `.env.example`
- **Also:** root has `REDIS_PORT=6379` (redundant with URL).

### 2. RabbitMQ
- **Variable:** `RABBITMQ_URL=amqp://lframework:lframework@localhost:5672`
- **Present in:** root `.env.example`, root `.env`, identity-service (both), catalog-service `.env.example`
- **Also:** root repeats the same data as individual vars: `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_MANAGEMENT_PORT`.

### 3. Identity service
- **IDENTITY_SERVICE_PORT=3001** — root (both) + identity-service (both).
- **IDENTITY_DATABASE_URL** — root (both) + identity-service (both).  
  **Inconsistency:** root uses DB name `lframework`; identity-service correctly uses `lframework_identity`.
- **JWT_SECRET**, **JWT_EXPIRES_IN_SECONDS**, **BASE_URL** — root `.env.example` (Identity section) + identity-service (both), same values.
- **GOOGLE_CLIENT_ID**, **GOOGLE_CLIENT_SECRET**, **GITHUB_CLIENT_ID**, **GITHUB_CLIENT_SECRET** — root `.env.example` + identity-service (both).

### 4. Catalog service
- **CATALOG_SERVICE_PORT=3002** — root (both) + catalog-service `.env.example`.
- **CATALOG_DATABASE_URL** — root (both) + catalog-service `.env.example` (same value).
- **REDIS_URL**, **RABBITMQ_URL** — same as above.
- **BASE_URL** — root (Identity uses 3001); catalog-service uses `http://localhost:3002` (service-specific).

### 5. PostgreSQL
- Root has both **atomic vars** (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `POSTGRES_HOST`) and **connection strings** (`DATABASE_URL`, `IDENTITY_DATABASE_URL`, `CATALOG_DATABASE_URL`). The connection strings duplicate user/password/host/port; only the DB name differs.

### 6. API docs / gateway
- **API_DOCS_PORT** — root only (`.env` has 3000, `.env.example` has 3003).
- **GATEWAY_PORT** — root only.

---

## Summary table (who defines what)

| Variable | Root .env.example | Root .env | identity-service | catalog-service |
|----------|-------------------|-----------|------------------|-----------------|
| REDIS_URL | ✓ | ✓ | ✓ | ✓ |
| RABBITMQ_URL | ✓ | ✓ | ✓ | ✓ |
| IDENTITY_SERVICE_PORT | ✓ | ✓ | ✓ | — |
| CATALOG_SERVICE_PORT | ✓ | ✓ | — | ✓ |
| IDENTITY_DATABASE_URL | ✓ (wrong DB name) | ✓ (wrong DB name) | ✓ (correct) | — |
| CATALOG_DATABASE_URL | ✓ | ✓ | — | ✓ |
| JWT_*, BASE_URL, OAuth | ✓ | — | ✓ | — |
| BASE_URL (catalog) | — | — | — | ✓ |

---

## Recommendations

1. **Single source of truth:** Treat **root `.env`** (and root `.env.example`) as the canonical place for all shared and service-specific vars when running the monorepo from the root (e.g. `pnpm run dev`, Docker Compose).
2. **Fix root for Identity DB:** In root `.env.example` and `.env`, set `IDENTITY_DATABASE_URL=.../lframework_identity` so it matches identity-service and Prisma.
3. **Package-level .env:** Keep identity-service and catalog-service `.env.example` only if you run those packages in isolation (e.g. `cd packages/identity-service && pnpm dev`). Then they should **reference** the root (e.g. comment: “Copy from repo root .env or set these”) and avoid redefining the same default values in multiple places.
4. **Remove redundant vars:** In root, you can drop `REDIS_PORT` (included in `REDIS_URL`) and consider building RabbitMQ URL from `RABBITMQ_USER`, etc., or keep only `RABBITMQ_URL` and drop the atomic RabbitMQ vars if nothing uses them.
5. **Align API_DOCS_PORT:** Use the same default in root `.env` and `.env.example` (e.g. 3003 or 3000) and document it.

Applying recommendation 2 (fix Identity DB name in root) next.
