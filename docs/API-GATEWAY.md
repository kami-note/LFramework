# API Gateway (Nginx)

O LFramework expõe um **API Gateway** via Nginx em container Docker. Todas as requisições aos microserviços passam por um único ponto de entrada (porta configurável, padrão **8080**).

## Visão geral

| Componente    | Descrição |
|---------------|-----------|
| **Imagem**    | `nginx:alpine` |
| **Porta**     | `GATEWAY_PORT` (default: 8080) |
| **Config**    | `nginx/nginx.conf` (montado como volume) |
| **Upstreams** | Identity (3001), Catalog (3002) via `host.docker.internal` |

O Nginx roda dentro do Docker e faz proxy para os serviços que rodam no host (quando você usa `pnpm run dev`). Em Linux, isso é possível graças a `extra_hosts: host.docker.internal:host-gateway` no `docker-compose.yml`.

---

## Rotas do gateway

Todas as URLs são relativas à base do gateway: `http://localhost:8080` (ou o valor de `GATEWAY_PORT`).

### Gateway

| Método | Path     | Descrição |
|--------|----------|-----------|
| `GET`  | `/health` | Health check do próprio gateway (JSON). |
| `GET`  | `/`      | 404 com mensagem indicando uso de `/identity/` ou `/catalog/`. |

### Identity Service (prefixo `/identity/`)

| Método | Path do gateway                  | Proxy para (identity-service)    |
|--------|----------------------------------|-----------------------------------|
| `POST` | `/identity/api/users`            | `POST /api/users`                 |
| `GET`  | `/identity/api/users/:id`        | `GET /api/users/:id`              |
| `POST` | `/identity/api/auth/register`     | `POST /api/auth/register`        |
| `POST` | `/identity/api/auth/login`       | `POST /api/auth/login`           |
| `GET`  | `/identity/api/auth/me`          | `GET /api/auth/me` (Bearer JWT)   |
| `GET`  | `/identity/api/auth/google`      | `GET /api/auth/google` (redirect) |
| `GET`  | `/identity/api/auth/google/callback` | `GET /api/auth/google/callback` |
| `GET`  | `/identity/api/auth/github`      | `GET /api/auth/github` (redirect) |
| `GET`  | `/identity/api/auth/github/callback`  | `GET /api/auth/github/callback` |
| `GET`  | `/identity/health`               | `GET /health`                    |

### Catalog Service (prefixo `/catalog/`)

| Método | Path do gateway        | Proxy para (catalog-service) |
|--------|------------------------|-------------------------------|
| `POST` | `/catalog/api/items`   | `POST /api/items`             |
| `GET`  | `/catalog/api/items`   | `GET /api/items`              |
| `GET`  | `/catalog/health`      | `GET /health`                 |

O Nginx remove o prefixo (`/identity/` ou `/catalog/`) ao repassar para o serviço. Por exemplo: `GET /identity/api/users/123` → `GET /api/users/123` no identity-service.

---

## Como rodar

1. **Subir infraestrutura e gateway**
   ```bash
   pnpm docker:up
   ```
   Isso sobe Postgres, Redis, RabbitMQ e **Nginx**. O gateway fica em `http://localhost:8080`.

2. **Subir os microserviços no host**
   ```bash
   pnpm run dev
   ```
   Ou em terminais separados: `pnpm dev:identity` e `pnpm dev:catalog`.

3. **Chamar a API pelo gateway**
   Use sempre a base `http://localhost:8080` e os prefixos `/identity/` e `/catalog/` conforme a tabela acima.

---

## Exemplos com cURL

```bash
# Health do gateway
curl http://localhost:8080/health

# Identity: health e usuários
curl http://localhost:8080/identity/health
curl -X POST http://localhost:8080/identity/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","name":"João"}'
curl http://localhost:8080/identity/api/users/<id>

# Catalog: health e itens
curl http://localhost:8080/catalog/health
curl http://localhost:8080/catalog/api/items
curl -X POST http://localhost:8080/catalog/api/items \
  -H "Content-Type: application/json" \
  -d '{"name":"Produto","priceAmount":9999,"priceCurrency":"BRL"}'
```

---

## Configuração

### Variáveis de ambiente

| Variável       | Descrição                    | Default |
|----------------|------------------------------|---------|
| `GATEWAY_PORT` | Porta HTTP do gateway no host | `8080`  |

Defina no `.env` na raiz do projeto (ou use o `.env.example` como base).

### Arquivo de configuração do Nginx

- **Caminho no projeto:** `nginx/nginx.conf`
- **Montagem no container:** `/etc/nginx/nginx.conf` (somente leitura)

Para alterar upstreams, timeouts, headers ou novas rotas, edite `nginx/nginx.conf` e reinicie o container:

```bash
docker compose restart nginx
```

### Subir só o gateway

Se a infra (Postgres, Redis, RabbitMQ) já estiver no ar e você quiser subir apenas o Nginx:

```bash
docker compose up -d nginx
```

---

## Headers repassados

O gateway envia aos serviços:

- `Host` – host original da requisição
- `X-Real-IP` – IP do cliente
- `X-Forwarded-For` – cadeia de proxies
- `X-Forwarded-Proto` – esquema (http/https)

Os serviços podem usar esses headers para logs, rate limit por IP ou redirecionamentos seguros.

---

## Troubleshooting

- **502 Bad Gateway**  
  Os serviços no host (3001, 3002) não estão rodando ou não estão acessíveis. Confirme com `curl http://localhost:3001/health` e `curl http://localhost:3002/health`. No Linux, verifique se o Docker está usando `host.docker.internal:host-gateway` no serviço `nginx`.

- **Porta 8080 em uso**  
  Altere `GATEWAY_PORT` no `.env` (ex.: `GATEWAY_PORT=9080`) e suba de novo com `docker compose up -d`.

- **Alterações em `nginx.conf` não valem**  
  Reinicie o container: `docker compose restart nginx`. Se precisar recarregar sem reiniciar: `docker compose exec nginx nginx -s reload` (válido se a config suportar reload).
