# Estrutura e convenções (estilo Laravel)

Este documento define **onde cada coisa vai** e **como nomear**. Ao adicionar um recurso ou um novo serviço, você sabe em qual pasta e com qual nome criar os arquivos.

---

## 1. Mapa de um microserviço

Todo microserviço em `packages/<nome>-service/` segue a **mesma árvore**.

```
packages/<serviço>/src/
├── index.ts                    # Entry: env, container, Express, listen
├── container.ts                # Composition root: adapters + use cases + routes
│
├── domain/
│   ├── entities/
│   │   ├── index.ts
│   │   └── <entidade>.entity.ts
│   ├── value-objects/
│   │   ├── index.ts
│   │   └── <nome>.vo.ts
│   └── repository-interfaces/
│       └── <entidade>-repository.interface.ts
│
├── application/
│   ├── ports/
│   │   ├── index.ts
│   │   └── <contrato>.port.ts
│   ├── use-cases/
│   │   ├── index.ts
│   │   ├── create-<entidade>.use-case.ts
│   │   ├── get-<entidade>-by-id.use-case.ts
│   │   └── list-<entidades>.use-case.ts   # se fizer sentido
│   ├── dtos/
│   │   ├── create-<entidade>.dto.ts
│   │   └── <entidade>-response.dto.ts
│   └── errors.ts               # Erros de aplicação (ex.: UserAlreadyExistsError)
│
└── infrastructure/
    ├── http/
    │   ├── routes.ts           # createXxxRoutes(controller) -> Router (serviço com auth pode ter auth.routes.ts em paralelo)
    │   ├── <recurso>.controller.ts
    │   ├── <recurso>.validation.ts   # safeParse + sendValidationError (shared)
    │   └── utils/               # opcional; helpers HTTP vêm do shared
    ├── persistence/
    │   └── prisma-<entidade>.repository.ts
    └── messaging/              # se o serviço publica ou consome eventos
        └── rabbitmq-*.ts
```

Se o arquivo não se encaixa em nenhuma pasta acima, a estrutura está errada ou falta uma pasta — não invente um lugar novo sem atualizar este doc.

---

## 2. Convenções de nomeação

| Tipo | Arquivo | Exemplo de nome |
|------|---------|------------------|
| Entidade | `domain/entities/<nome>.entity.ts` | `User`, `Item` |
| Value object | `domain/value-objects/<nome>.vo.ts` | `Email`, `Money` |
| Interface repositório | `domain/repository-interfaces/<entidade>-repository.interface.ts` | `IUserRepository` |
| Porta | `application/ports/<nome>.port.ts` | `IEventPublisher`, `ICacheService` |
| Use case | `application/use-cases/<ação>-<entidade>.use-case.ts` | `CreateUserUseCase`, `GetUserByIdUseCase` |
| DTO | `application/dtos/create-<entidade>.dto.ts`, `<entidade>-response.dto.ts` | `CreateItemDto`, `ItemResponseDto` |
| Controller | `infrastructure/http/<recurso>.controller.ts` | `UserController`, `ItemController` |
| Validação | `infrastructure/http/<recurso>.validation.ts` | `validateCreateUser`, `validateCreateItem` |
| Repository (impl.) | `infrastructure/persistence/prisma-<entidade>.repository.ts` | `PrismaUserRepository` |

---

## 3. Checklist: novo recurso (entidade) no serviço

Exemplo: adicionar **Order** no catalog-service.

1. **Domain**
   - [ ] `domain/entities/order.entity.ts` (e export em `entities/index.ts`)
   - [ ] Value objects em `domain/value-objects/` se precisar
   - [ ] `domain/repository-interfaces/order-repository.interface.ts`

2. **Application**
   - [ ] `application/dtos/create-order.dto.ts` e `order-response.dto.ts` (use `nameSchema` do shared para nomes se for o caso)
   - [ ] Use cases em `application/use-cases/` (ex.: `create-order.use-case.ts`, `get-order-by-id.use-case.ts`)
   - [ ] Novas portas em `application/ports/` só se precisar
   - [ ] Erros em `application/errors.ts` se surgir erro de domínio novo

3. **Infrastructure**
   - [ ] `infrastructure/persistence/prisma-order.repository.ts`
   - [ ] Migração Prisma e `prisma migrate dev`
   - [ ] `infrastructure/http/order.controller.ts` (use `sendError` do shared)
   - [ ] `infrastructure/http/order.validation.ts` (use `sendValidationError` do shared)
   - [ ] Em `routes.ts`: criar `createOrderRoutes(controller)` e registrar rotas
   - [ ] Em `container.ts`: instanciar repositório, use cases, controller e registrar rotas

---

## 4. Checklist: novo microserviço

1. Copiar a pasta de um serviço existente (ex.: `identity-service`) e renomear para `packages/<novo>-service/`.
2. Trocar nomes de entidades/recursos; manter a **mesma árvore** deste documento.
3. Ajustar `package.json` (nome do package, scripts).
4. Ajustar `prisma/schema.prisma` (modelos do novo contexto).
5. Em `container.ts`: mesmo padrão (config → Prisma, Redis, repositórios, use cases, controllers, routes).
6. Em `index.ts`: carregar env, `createContainer(config)`, conectar messaging se houver, montar Express com `/api` e `/health`, listen, SIGTERM → disconnect.
7. Se publicar ou consumir eventos: usar tipos e constantes de `@lframework/shared` (payloads, exchanges, filas).
8. Importar `sendError`, `sendValidationError` e schemas comuns (ex.: `nameSchema`) do shared onde fizer sentido.

---

## 5. O que fica no `packages/shared`

- **Eventos:** tipos de payload, nomes de eventos, constantes RabbitMQ.
- **Contratos e helpers:** `ErrorResponseDto`, `sendError`, `sendValidationError`, `nameSchema` (e outros schemas comuns no futuro).
- **Cache:** porta `ICacheService`, adapter Redis (se todos usam o mesmo).

**Não colocar no shared:** regras de negócio de um único serviço, DTOs de API específicos, bootstrap de cada app. Isso evita que o shared vire um monte de exceções.

---

## 6. Resumo

- **Um serviço = uma árvore fixa.** Novos recursos = novos arquivos nas mesmas pastas, com os nomes das convenções.
- **Novo serviço = copiar árvore e renomear.** Sem inventar outra estrutura.
- **Shared = núcleo do framework.** Eventos, DTOs de erro, helpers HTTP, schemas comuns; o resto fica no serviço.
