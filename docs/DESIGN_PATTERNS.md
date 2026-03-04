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
| identity | `IUserCreatedNotifier`      | `UserCreatedNotifierAdapter`                  | Register, CreateUser, OAuthCallback |
| catalog  | `IItemsListCacheInvalidator`| `ItemsListCacheInvalidatorAdapter`           | CreateItem                 |

---

## 2. Error-to-HTTP mapper (SRP / DRY)

**Ideia:** A decisão “qual erro de aplicação vira qual status HTTP” fica em **um único lugar** por serviço. Controllers só chamam o use case, em caso de erro chamam o mapeador e depois `sendError(res, statusCode, message)`.

**Quando usar:** Em todo microserviço que expõe HTTP e lança erros de aplicação (subclasses de `Error`).

**Como replicar:**

1. **Tipo compartilhado:** usar `HttpErrorMapping` de `@lframework/shared` (já exportado em `http`).

2. **Criar** `application/http/error-to-http.mapper.ts` no serviço:
   - Função `mapApplicationErrorToHttp(err: unknown): HttpErrorMapping`.
   - `if (err instanceof MeuErroDeApp)` → retornar `{ statusCode, message }`.
   - Caso padrão: `{ statusCode: 500, message: "Internal server error" }`.

3. **No controller:** no `catch`, chamar `const { statusCode, message } = mapApplicationErrorToHttp(err)` e `sendError(res, statusCode, message)`.

**Exemplos:**

- **identity:** `UserAlreadyExistsError` → 409, `InvalidCredentialsError` → 401, `InvalidEmailError` / `PasswordValidationError` → 400.
- **catalog:** `InvalidItemError` → 400.

O **tipo** `HttpErrorMapping` é compartilhado; a **função** de mapeamento é por serviço (cada um conhece seus próprios erros).

---

## 3. Resumo: checklist para novo use case ou novo serviço

- [ ] Use case recebe apenas **portas** (interfaces) no construtor; nenhuma implementação concreta de infra.
- [ ] Efeitos colaterais (evento, cache, etc.) atrás de uma **porta** com nome claro; adapter em infrastructure.
- [ ] Serviço tem **um** `application/http/error-to-http.mapper.ts` que mapeia erros do serviço para `HttpErrorMapping`.
- [ ] Controllers usam o mapeador no `catch` e `sendError(res, statusCode, message)`.
- [ ] Container (composition root) instancia adapters e injeta nas portas dos use cases.

Assim os padrões permanecem **replicáveis** em qualquer novo recurso ou microserviço.
