# @lframework/shared

Pacote compartilhado do monorepo LFramework: infraestrutura HTTP, logging, erros, cache, eventos e tipos comuns.

## Exports principais

- **Logger:** `logger` (Pino; em dev usa pretty, em prod JSON)
- **HTTP:** `asyncHandler`, `requestIdMiddleware`, `errorHandlerMiddleware`, `createAuthMiddleware`, `requireRole`, `sendError`, `sendValidationError`
- **DTOs:** `HealthResponseDto`
- **Erros:** `AppError`
- **Cache:** adapters e tipos (`RedisCacheAdapter`, etc.)
- **Eventos:** payloads e constantes (`UserCreatedPayload`, etc.)

## Uso rápido

### createAuthMiddleware

```ts
import { createAuthMiddleware } from "@lframework/shared";
import jwt from "jsonwebtoken";

const auth = createAuthMiddleware((token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"] }) as { sub?: string };
    return decoded.sub ? { sub: decoded.sub } : null;
  } catch {
    return null;
  }
});

app.use("/api/private", auth, privateRoutes);
```

### request-id + error-handler

```ts
import { requestIdMiddleware, errorHandlerMiddleware } from "@lframework/shared";

app.use(requestIdMiddleware);
// ... rotas ...
app.use(errorHandlerMiddleware);
```

## Desenvolvimento

Em desenvolvimento o logger usa **pino-pretty** para saída legível quando o pacote está instalado (ex.: `pnpm add -D pino-pretty` no app ou no workspace). Se `pino-pretty` não estiver disponível, o logger faz fallback para saída JSON no stdout, sem falhar.
