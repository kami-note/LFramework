/**
 * Evento de domínio compartilhado: usuário criado.
 * Publicado pelo Identity Service; consumido por outros serviços (ex.: Catalog).
 *
 * Consumidores não devem confiar no payload: validar userId, email (formato, max 254, sem < >),
 * name (trim, min/max 200, apenas letras/números/espaços/hífen/apóstrofo) e
 * occurredAt (string em ISO 8601 válida).
 */
export interface UserCreatedPayload {
  userId: string;
  email: string;
  name: string;
  /** Data do evento em ISO 8601 (ex.: 2025-01-01T00:00:00.000Z). Consumidores devem validar. */
  occurredAt: string;
}

export const USER_CREATED_EVENT = "user.created";
