# Resiliência — timeouts e retry

Este documento descreve os timeouts e a política de retry usados nas dependências críticas (Redis, Prisma, RabbitMQ, HTTP OAuth) para evitar espera indefinida e melhorar a tolerância a falhas.

---

## 1. Redis (ioredis)

| Configuração       | Valor  | Onde                         |
|--------------------|--------|------------------------------|
| **connectTimeout** | 5000 ms| identity-service, catalog-service (container) |
| **commandTimeout** | 5000 ms| identity-service, catalog-service (container) |

- **connectTimeout**: tempo máximo para estabelecer a conexão TCP com o Redis; após esse tempo a conexão falha.
- **commandTimeout**: tempo máximo para cada comando (GET, SET, etc.); comando que exceder dispara erro.

**Retry**: ioredis possui reconexão automática por padrão. Não há retry explícito no código da aplicação; em caso de falha de comando/timeout o erro propaga e o middleware de erro responde 500.

Referência: [ioredis options](https://github.com/redis/ioredis#connecttimeout).

---

## 2. Prisma

O Prisma Client **não oferece timeout global** por query. As opções atuais:

- **Transações interativas** (`$transaction(async (tx) => ...)`): aceitam opção `{ timeout: N }` (ms). O default é 5000 ms. Em transações longas, pode-se aumentar no código (ex.: `$transaction(fn, { timeout: 10_000 })`).
- **Transações sequenciais** (`$transaction([op1, op2])`): usam o timeout padrão implícito do driver; não há API Prisma para alterar por chamada.
- **Conexão**: timeouts de pool/conexão dependem do driver (ex.: pg); não são configurados no PrismaClient neste projeto.

**Recomendação**: manter transações curtas; em pontos críticos com transação interativa, definir `timeout` explicitamente se necessário. Em caso de queries lentas, investigar índices e plano de execução.

---

## 3. HTTP OAuth (Google, GitHub)

Chamadas `fetch` aos provedores OAuth usam:

| Configuração     | Valor   | Onde                                      |
|------------------|---------|-------------------------------------------|
| **Timeout**      | 10 s    | Todas as requisições (token, userinfo, emails) |
| **AbortSignal**  | Sim     | Passado em cada `fetch` via helper         |
| **Retry**        | 1 tentativa extra | Apenas em falhas de rede/timeout (AbortError ou erro de rede) |

- **Implementação**: helper `fetchWithTimeoutAndRetry` em `packages/identity-service/src/infrastructure/auth/fetch-with-timeout.ts`. Usa `AbortController` para cancelar após 10 s; em falha considerada retentável (timeout/rede), faz uma nova tentativa após 1 s.
- **Onde se aplica**: `GoogleOAuthProvider` e `GitHubOAuthProvider` (troca de code por token e obtenção de userinfo/emails).

---

## 4. RabbitMQ (amqplib)

| Configuração       | Valor   | Onde                                                                 |
|--------------------|---------|----------------------------------------------------------------------|
| **Connection timeout** | 10 s | identity-service: `RabbitMqEventPublisherAdapter`; catalog-service: `RabbitMqUserEventsAdapter` |

- **Opção**: `amqp.connect(url, { timeout: 10_000 })`. O timeout é aplicado ao socket de conexão; se o broker não responder nesse tempo, a conexão falha.
- **Retry**: não implementado no código; em startup, se a conexão falhar (ex.: broker down), o processo falha e pode ser reiniciado por orquestrador (ex.: systemd, K8s). Para retry automático na aplicação, seria necessário envolver `connect()` em um loop com backoff (documentado como melhoria futura).

---

## 5. Resumo da política de retry

| Dependência | Timeout aplicado | Retry no código |
|-------------|------------------|-----------------|
| Redis       | connect 5 s, command 5 s | Não (reconexão automática pelo ioredis) |
| Prisma      | Transação: default 5 s (configurável em transações interativas) | Não |
| HTTP OAuth  | 10 s por request | Sim: 1 retry com 1 s de delay em falha de rede/timeout |
| RabbitMQ    | Conexão 10 s     | Não (falha no startup; reinício externo) |

Em produção, recomenda-se também: health checks (Redis, DB, RabbitMQ), limites de recursos (memory/CPU) e restart policy do processo (ex.: systemd ou Kubernetes) para recuperação após falhas que não sejam tratadas por retry interno.
