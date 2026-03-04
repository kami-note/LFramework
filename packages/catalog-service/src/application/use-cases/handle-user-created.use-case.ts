import type { UserCreatedPayload } from "@lframework/shared";
import { logger } from "@lframework/shared";
import type { ICacheService } from "@lframework/shared";

/**
 * Use case: processa o evento UserCreated (publicado pelo Identity Service).
 * Invalida cache associado ao usuário para que dados futuros refletindo
 * criação/atualização no identity sejam recarregados.
 *
 * Ponto de extensão: quando surgir a necessidade de "criar dados locais"
 * (ex.: perfil do usuário no catalog), injetar as portas necessárias
 * (ex.: repositório) e implementar aqui.
 */
export class HandleUserCreatedUseCase {
  constructor(private readonly cache: ICacheService) {}

  async execute(payload: UserCreatedPayload): Promise<void> {
    // P1.5: não logar PII (email); apenas identificador opaco.
    logger.info({ userId: payload.userId }, "UserCreated received");

    const key = `user:${payload.userId}`;
    await this.cache.delete(key);
  }
}
