# Technical review — current state

Short technical review of the LFramework monorepo: architecture, recent changes, and alignment with docs. For the full backlog and severity table, see [CODE_REVIEW.md](CODE_REVIEW.md).

---

## 1. Architecture and structure

- **Layout:** Services use **adapters** (`adapters/driving/`, `adapters/driven/`), not `infrastructure/`. [STRUCTURE.md](STRUCTURE.md) is correct; **CODE_REVIEW.md still references old paths** (`infrastructure/` → should read `adapters/driving/` or `adapters/driven/` as appropriate).
- **Composition:** Single composition root per service (`container.ts`), Awilix, no circular dependencies.
- **Ports:** All in `application/ports/`; use cases depend only on interfaces; DIP and hexagonal boundaries are respected.

---

## 2. Recent additions (validation)

| Change | Location | Notes |
|--------|----------|--------|
| **App factory** | `identity-service/src/app.ts` | `createApp(container, options)` builds Express without `listen`; used by `index.ts` and integration tests. Keeps SRP and testability. |
| **Integration tests** | `identity-service/src/__tests__/integration/auth.integration.spec.ts` | Auth API (register, login, /auth/me, health) with supertest; skip when DB/Redis unavailable; no RabbitMQ required (no-op event publisher). |
| **Event publisher override** | `identity-service/container.ts` | `eventPublisherOverride` in `ContainerConfig` allows tests to run without RabbitMQ. |
| **Env cleanup** | Root and package `.env.example` / `.env` | Removed unused vars (`POSTGRES_HOST`, `RABBITMQ_HOST`), redundant comments; fixed Identity DB name to `lframework_identity` in root. |
| **ENV_ANALYSIS.md** | `docs/ENV_ANALYSIS.md` | Documents duplication and single source of truth (root `.env`). |

---

## 3. Security and configuration

- **Production:** No credential fallbacks in production; services exit if required env is missing (see [SECURITY.md](SECURITY.md)).
- **Validation:** Zod on all inputs; body size limit 512kb; rate limiting on auth and OAuth routes.
- **CORS:** Identity and catalog both use optional CORS via `CORS_ORIGIN` (CODE_REVIEW item #1 is addressed for catalog).

---

## 4. Resilience and messaging

- **Identity:** `fetchWithTimeout` for OAuth; Redis/Prisma with timeouts where configured.
- **Catalog consumer:** RabbitMQ UserCreated consumer implements **bounded retries** (MAX_RETRIES, backoff, dead-letter to `QUEUE_USER_CREATED_CATALOG_FAILED`). CODE_REVIEW item #3 (nack without limit) is addressed.

---

## 5. Testing

- **Unit:** Use cases, DTOs, controllers, shared middleware and helpers have specs; absurd tests for edge cases.
- **Integration:** Identity has HTTP integration tests (auth + health); they skip when DB is unavailable; run with `pnpm test:integration` (identity-service).
- **Gap:** AuthController and error-to-http mappers still without dedicated unit tests (see CODE_REVIEW §2.2 #8).

---

## 6. TypeScript and type safety

- **Strict:** Enabled across packages.
- **Remaining risks:** `JSON.parse(raw) as T` in Redis cache; JWT and OAuth response shapes trusted without Zod (CODE_REVIEW §2.2 #5, #6, #7). Recommendation: validate external/cached data with Zod and avoid `as T`.

---

## 7. Documentation and paths

- **README:** Migration commands use `exec prisma migrate dev`; package scripts use `prisma:migrate` (e.g. `pnpm --filter identity-service prisma:migrate`). Both are valid; DEVELOPMENT.md should state when to use which.
- **CODE_REVIEW.md:** Update all `infrastructure/` paths to `adapters/driving/` or `adapters/driven/` so they match the codebase.

---

## 8. Recommendations (priority)

1. **Paths in CODE_REVIEW.md:** Replace `infrastructure/` with the correct `adapters/driving/` or `adapters/driven/` paths in every table.
2. **Validation of external data:** Add Zod validation for JWT payload (identity), OAuth API responses, and Redis cache deserialization (CODE_REVIEW items 5, 6, 7).
3. **Unit tests:** Add specs for AuthController (register, login, me, OAuth callback) and for identity/catalog error-to-http mappers.
4. **asyncHandler / handler types:** If the `controller.me.bind(controller)` cast was removed, mark CODE_REVIEW item #2 as resolved; otherwise keep the recommendation to widen asyncHandler’s accepted handler signature.

---

## 9. References

- [CODE_REVIEW.md](CODE_REVIEW.md) — Full backlog and severity.
- [ARCHITECTURE.md](ARCHITECTURE.md) — Hexagonal layout and shared.
- [STRUCTURE.md](STRUCTURE.md) — Folder and naming conventions.
- [SECURITY.md](SECURITY.md) — Validation and secrets.
- [ENV_ANALYSIS.md](ENV_ANALYSIS.md) — Env duplication and consolidation.
