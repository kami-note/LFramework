/**
 * Evento de domínio compartilhado: usuário criado.
 * Publicado pelo Identity Service; consumido por outros serviços (ex.: Catalog).
 */
export interface UserCreatedPayload {
  userId: string;
  email: string;
  name: string;
  occurredAt: string; // ISO 8601
}

export const USER_CREATED_EVENT = "user.created";

export type UserCreatedEvent = {
  type: typeof USER_CREATED_EVENT;
  payload: UserCreatedPayload;
};
