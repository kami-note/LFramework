/**
 * Constantes para RabbitMQ: exchanges e filas compartilhados.
 * Centralize aqui para manter contrato entre publicadores e consumidores.
 */
export const EXCHANGE_USER_EVENTS = "user.events";
export const QUEUE_USER_CREATED_CATALOG = "catalog.user_created";
/** Fila para mensagens UserCreated que excederam MAX_RETRIES (dead-letter / inspeção). */
export const QUEUE_USER_CREATED_CATALOG_FAILED = "catalog.user_created.failed";
