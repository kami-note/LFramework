# Padrões replicáveis (SOLID + design patterns)

Este documento descreve padrões usados no LFramework para manter consistência entre microserviços e novos use cases. **São replicáveis**: ao adicionar um novo serviço ou fluxo, siga o mesmo modelo.

---

## 1. Porta + Adapter para efeitos colaterais (DIP)

**Ideia:** Use cases não dependem de implementações concretas (Redis, RabbitMQ, etc.). Eles dependem de **uma porta** (interface) que descreve “o que precisa acontecer”; a **implementação** fica em infrastructure.

**Quando usar:** Sempre que um use case orquestra um efeito colateral que pode ser implementado de mais de uma forma (ex.: publicar evento + gravar cache, invalidar cache de lista).

**Como replicar:**

1. **Definir a porta** em `application/ports/`:
   - Nome que descreve a responsabilidade: `IUserCreatedNotifier`, `IItemsListCacheInvalidator`.
   - Método(s) com assinatura estável (ex.: `notify(user)`, `invalidate()`).

2. **Implementar o adapter** em `infrastructure/` (pasta coerente: `notifiers/`, `cache/`, `messaging/`):
   - Classe que implementa a interface e usa as portas/implementações concretas necessárias (ex.: `IEventPublisher`, `ICacheService`).

3. **No use case:** receber a porta no construtor e chamá-la no fluxo (sem conhecer Redis/RabbitMQ).

4. **No container:** instanciar o adapter (injetando cache, eventPublisher, etc.) e passar para o use case.

**Exemplos no projeto:**

| Serviço   | Porta                       | Adapter                                      | Use cases que usam        |
|----------|-----------------------------|----------------------------------------------|----------------------------|
| identity | `IUserCreatedNotifier`      | `UserCreatedNotifierAdapter` (cache only; events via Outbox) | Register, CreateUser, OAuthCallback |
| catalog  | `IItemsListCacheInvalidator`| `ItemsListCacheInvalidatorAdapter`           | CreateItem                 |
| catalog  | `IReplicatedUserStore`      | `PrismaReplicatedUserStore` (data replication from user.created) | HandleUserCreatedUseCase  |

---

## 2. Outbox Pattern (reliable event publishing)

**Ideia:** Write the event to an **outbox table** in the **same transaction** as the business data. A relay process later reads unpublished rows and publishes to the message broker, then marks them as published. This guarantees no event is lost if the broker is down or the process crashes after the DB commit.

**Como está implementado:**

- **Identity:** table `outbox` (id, event_name, payload, created_at, published_at). Register, OAuth and CreateUser persist user (and credential/OAuth when applicable) **and** one outbox row in a single transaction. `OutboxRelayAdapter` runs periodically (e.g. every 2s), publishes to RabbitMQ and sets `published_at`. Port: `OutboxEvent` type; persistence ports accept optional `outboxEvent`; `IUserRepository.saveUserAndOutbox` for CreateUser.

---

## 3. Error-to-HTTP mapper (SRP / DRY)

**Ideia:** A decisão “qual erro de aplicação vira qual status HTTP” fica em **um único lugar** por serviço. Controllers só chamam o use case, em caso de erro chamam o mapeador e depois `sendError(res, statusCode, message)`.

**Quando usar:** Em todo microserviço que expõe HTTP e lança erros de aplicação (subclasses de `Error`).

**Como replicar:**

1. **Tipo e factory no shared:** usar `HttpErrorMapping` e `createErrorToHttpMapper` de `@lframework/shared`.

2. **Criar** `application/http/error-to-http.mapper.ts` no serviço:
   - Exportar `mapApplicationErrorToHttp = createErrorToHttpMapper([[MeuErro, statusCode], ...])`.
   - Cada serviço passa seus erros e códigos HTTP; erros desconhecidos retornam 500.

3. **No controller:** no `catch`, chamar `const { statusCode, message } = mapApplicationErrorToHttp(err)` e `sendError(res, statusCode, message)`. Em rotas que podem falhar com erro inesperado (ex.: getById, me), logar o erro com `logger.error({ err, requestId }, "...")` antes de enviar 500.

**Exemplos:**

- **identity:** `UserAlreadyExistsError` → 409, `InvalidCredentialsError` → 401, `InvalidEmailError` / `PasswordValidationError` → 400.
- **catalog:** `InvalidItemError` → 400.

O **tipo** `HttpErrorMapping` e a **factory** `createErrorToHttpMapper` ficam no shared; cada serviço instancia o mapeador com seus erros.

---

## 4. Validação de body (createValidateBody)

**Ideia:** O shared oferece `createValidateBody(schema)` (Zod). O middleware valida `req.body`; em sucesso atribui o resultado a `req.body` e chama `next()`; em falha chama `sendValidationError(res, result.error)`. Deve ser usado após `express.json()`; se `req.body` for undefined, é tratado como `{}`.

**Como replicar:** Em `infrastructure/http/<recurso>.validation.ts`, exportar `const validateCreateX = createValidateBody(createXSchema)` e usar nas rotas. Ex.: identity usa `validateCreateUser`, `validateRegister`, `validateLogin`; catalog usa `validateCreateItem`.

---

## 5. Resumo: checklist para novo use case ou novo serviço

- [ ] Use case recebe apenas **portas** (interfaces) no construtor; nenhuma implementação concreta de infra.
- [ ] Efeitos colaterais (evento, cache, etc.) atrás de uma **porta** com nome claro; adapter em infrastructure.
- [ ] Serviço tem **um** `application/http/error-to-http.mapper.ts` com `createErrorToHttpMapper` (shared) e seus erros.
- [ ] Controllers usam o mapeador no `catch` e `sendError(res, statusCode, message)`; em catch de 500 genérico, logar com `logger.error({ err, requestId })`.
- [ ] Validação de body com `createValidateBody(schema)` do shared em `*.validation.ts`.
- [ ] Health com `createHealthHandler("nome-serviço")` do shared em GET `/health`.
- [ ] Container (composition root) instancia adapters e injeta nas portas dos use cases.

Assim os padrões permanecem **replicáveis** em qualquer novo recurso ou microserviço.
