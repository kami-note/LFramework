# Estrutura e convenções (estilo Laravel)

Este documento define **onde cada coisa vai** e **como nomear**. O objetivo é: ao adicionar uma feature ou um novo serviço, você saiba exatamente em qual pasta e com qual nome criar os arquivos — sem adivinhar.

---

## 1. Mapa de um microserviço

Todo microserviço em `packages/<nome>-service/` tem a **mesma árvore**. Use-a como checklist.

```
packages/<serviço>/src/
├── index.ts                    # Entrypoint: env, container, express, listen
├── container.ts                # Composição: instancia adapters + use cases + routes
│
├── domain/
│   ├── entities/
│   │   ├── index.ts            # barrel: export * from "./<entidade>.entity"
│   │   └── <entidade>.entity.ts
│   ├── value-objects/
│   │   ├── index.ts
│   │   └── <nome>.vo.ts
│   └── repository-interfaces/
│       └── <entidade>-repository.interface.ts
│
├── application/
│   ├── ports/
│   │   ├── index.ts            # barrel
│   │   └── <contrato>.port.ts  # ex: event-publisher.port.ts
│   ├── use-cases/
│   │   ├── index.ts
│   │   ├── create-<entidade>.use-case.ts
│   │   ├── get-<entidade>-by-id.use-case.ts
│   │   └── list-<entidades>.use-case.ts   # se fizer sentido
│   └── dtos/
│       ├── create-<entidade>.dto.ts
│       └── <entidade>-response.dto.ts
│
└── infrastructure/
    ├── http/
    │   ├── routes.ts           # createXxxRoutes(controller) -> Router
    │   └── <recurso>.controller.ts
    ├── persistence/
    │   └── prisma-<entidade>.repository.ts
    └── messaging/              # só se o serviço publica ou consome eventos
        ├── rabbitmq-*.ts       # adapters/consumers específicos
        └── ...
```

**Regra:** se o arquivo não se encaixa em nenhuma pasta acima, a estrutura está errada ou a pasta está faltando — não invente um lugar novo sem atualizar este doc.

---

## 2. O que vai em cada camada

| Camada | O que colocar | O que NÃO colocar |
|--------|----------------|--------------------|
| **domain/** | Entidades, value objects, **interfaces** de repositório e eventos. Regras de negócio puras. | Implementações (Prisma, Redis, HTTP), DTOs, detalhes de infra |
| **application/** | Use cases (orquestração), portas (interfaces), DTOs de entrada/saída. | Lógica de infra, conhecimento de HTTP/DB |
| **infrastructure/** | Controllers, repositórios Prisma, adapters RabbitMQ, tudo que “fala” com o mundo externo. | Regras de negócio, tipos de domínio complexos (só mapear para entidades/DTOs) |

---

## 3. Convenções de nomeação

- **Entidade:** `domain/entities/<nome>.entity.ts` → classe `User`, `Item`.
- **Value object:** `domain/value-objects/<nome>.vo.ts` → classe `Email`, `Money`.
- **Interface de repositório:** `domain/repository-interfaces/<entidade>-repository.interface.ts` → `IUserRepository`, `IItemRepository`.
- **Porta (outra interface):** `application/ports/<nome>.port.ts` → `IEventPublisher`, `IEventConsumer`.
- **Use case:** `application/use-cases/<ação>-<entidade>.use-case.ts` → `CreateUserUseCase`, `GetUserByIdUseCase`.
- **DTO:** `application/dtos/create-<entidade>.dto.ts` e `<entidade>-response.dto.ts`.
- **Controller:** `infrastructure/http/<recurso>.controller.ts` → `UserController`, `ItemController`.
- **Rotas:** `infrastructure/http/routes.ts` → função `createUserRoutes(controller)`, `createItemRoutes(controller)`.
- **Repository (implementação):** `infrastructure/persistence/prisma-<entidade>.repository.ts` → `PrismaUserRepository`.

Assim, “onde fica o use case de criar usuário?” → sempre `application/use-cases/create-user.use-case.ts`.

---

## 4. Checklist: adicionar um novo recurso (entidade) no serviço

Exemplo: adicionar **Order** no catalog-service.

1. **Domain**
   - [ ] `domain/entities/order.entity.ts` (e export em `domain/entities/index.ts`)
   - [ ] Value objects em `domain/value-objects/` se precisar (ex: `order-status.vo.ts`)
   - [ ] `domain/repository-interfaces/order-repository.interface.ts` (`IOrderRepository`)

2. **Application**
   - [ ] `application/dtos/create-order.dto.ts` e `order-response.dto.ts`
   - [ ] Use cases em `application/use-cases/` (ex: `create-order.use-case.ts`, `get-order-by-id.use-case.ts`)
   - [ ] Novas portas em `application/ports/` só se precisar (ex: evento novo)

3. **Infrastructure**
   - [ ] `infrastructure/persistence/prisma-order.repository.ts` implementando `IOrderRepository`
   - [ ] Migração Prisma: adicionar modelo no `prisma/schema.prisma` e rodar `prisma migrate dev`
   - [ ] `infrastructure/http/order.controller.ts`
   - [ ] Em `infrastructure/http/routes.ts`: criar `createOrderRoutes(controller)` e registrar rotas (ex: `router.post("/orders", ...)`)

4. **Container**
   - [ ] Em `container.ts`: instanciar `PrismaOrderRepository`, use cases de Order, `OrderController`, e chamar `createOrderRoutes`. Montar as rotas no app (ex: `app.use("/api", orderRoutes)` ou combinar com um router pai).

Seguindo isso, a estrutura **ajuda**: sempre o mesmo lugar para entidade, repositório, use case e controller.

---

## 5. Checklist: adicionar um novo microserviço

1. Copiar a pasta de um serviço existente (ex: `identity-service`) e renomear para `packages/<novo>-service/`.
2. Trocar nomes de entidades/recursos (User → seu agregado); manter a **mesma árvore** de pastas deste documento.
3. Ajustar `package.json` (nome do package, scripts).
4. Ajustar `prisma/schema.prisma` (modelos do novo contexto).
5. Em `container.ts`, manter o mesmo padrão: config (databaseUrl, redisUrl, rabbitmqUrl se usar mensageria) → Prisma, Redis, repositórios, use cases, controllers, routes → `connect`/`disconnect`.
6. Em `index.ts`, mesmo padrão: carregar env, `createContainer(config)`, conectar messaging (se houver), montar Express com `/api` e `/health`, listen, SIGTERM → disconnect.
7. Se publicar ou consumir eventos: usar tipos e constantes de `packages/shared` (ex: payloads, nomes de exchange/queue).

Assim, todo novo serviço **ajuda** no futuro: mesma estrutura, mesma forma de estender.

---

## 6. O que fica no `packages/shared`

- **Eventos entre serviços:** tipos de payload (ex: `UserCreatedPayload`), nomes de eventos.
- **Constantes de infraestrutura compartilhada:** ex: nomes de exchange e filas RabbitMQ.
- **Contratos que dois ou mais serviços usam:** ex: porta `ICacheService`, adapter `RedisCacheAdapter`, se todos usam o mesmo.

**Não colocar no shared:** regras de negócio de um único serviço, DTOs de API específicos, configuração de bootstrap (cada serviço monta seu próprio app e container). Isso evita que o shared vire um “monstro” e atrapalhe no futuro.

---

## 7. Resumo

- **Um serviço = uma árvore fixa.** Novos recursos (entidades) = novos arquivos nas mesmas pastas, com os nomes das convenções.
- **Novo serviço = copiar árvore e renomear.** Sem inventar outra estrutura.
- **Shared = só o que é realmente compartilhado.** Eventos, constantes, cache; o resto fica no serviço.

Com isso, a estrutura **ajuda** no futuro (como no Laravel: você sabe onde colocar cada coisa) e **não atrapalha** (não exige abstrações além do necessário; cada serviço continua dono do seu domínio e da sua infra).
