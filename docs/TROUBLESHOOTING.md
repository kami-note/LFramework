# Troubleshooting — LFramework

Guia rápido para interpretar erros da API e onde olhar ao debugar.

## Formato padrão de erro da API

As respostas de erro da API seguem o formato:

```json
{ "error": "string" }
```

O campo `error` contém a mensagem legível (ex.: "User not found", "Invalid email or password"). Em erros internos (500), o cliente recebe apenas `"Internal server error"` — o stack trace não é exposto.

---

## Códigos HTTP e causas prováveis

| Código | Significado        | Causa provável | Onde olhar |
|--------|--------------------|----------------|------------|
| **400** | Bad Request        | Payload inválido (body/query), validação Zod falhou (ex.: email inválido, name vazio, priceAmount negativo) | Body da requisição; mensagem em `error` |
| **401** | Unauthorized       | Token ausente ou inválido (Bearer JWT expirado, malformado ou assinatura incorreta) | Header `Authorization: Bearer <token>`; `JWT_SECRET` no servidor |
| **403** | Forbidden          | Token válido mas sem permissão (ex.: usuário comum acessando recurso de admin ou dados de outro usuário) | Regras de negócio (role, ownership) |
| **404** | Not Found          | Recurso não existe (ex.: usuário ou item por ID) | Path/ID; mensagem em `error` |
| **409** | Conflict           | Conflito com estado atual (ex.: email já cadastrado no register/create user) | Dados duplicados; mensagem em `error` |
| **429** | Too Many Requests  | Rate limit excedido (ex.: login/register, OAuth) | Limites em `express-rate-limit`; cabeçalhos de rate limit na resposta |
| **500** | Internal Server Error | Erro não tratado no servidor (ex.: falha de banco, Redis, RabbitMQ) | Logs do serviço (Pino); `requestId` no header da resposta para correlacionar |

---

## Dicas rápidas de debug

### 401 Unauthorized

- **Token ausente:** confira se o header está sendo enviado: `Authorization: Bearer <seu-jwt>`.
- **Token inválido/expirado:** decode o JWT (ex.: [jwt.io](https://jwt.io)) e verifique `exp` e a assinatura.
- **Serviço diferente do que emitiu:** Identity e Catalog devem usar o **mesmo** `JWT_SECRET`; se um gerar o token e o outro validar, o secret precisa ser idêntico em ambos.

### 409 Conflict (email já existe)

- O email já está cadastrado (register ou POST /api/users).
- Use outro email ou o endpoint de login se for o mesmo usuário.

### 500 Internal Server Error

- **Logs:** use o logger (Pino) do serviço; em desenvolvimento pode estar em pretty, em produção em JSON.
- **RequestId:** a resposta inclui o header `X-Request-Id`; use esse valor para buscar a mesma requisição nos logs.
- **Infra:** verifique conexão com PostgreSQL, Redis e RabbitMQ (variáveis `*_DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`).

---

## Documentação relacionada

- [API Gateway](API-GATEWAY.md) — rotas, proxy, exemplos cURL.
- [OpenAPI](openapi.yaml) — spec completa dos endpoints (paths, body, respostas, segurança).
