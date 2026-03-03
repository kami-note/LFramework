/**
 * Constantes para RabbitMQ: exchanges e filas compartilhados.
 * Centralize aqui para manter contrato entre publicadores e consumidores.
 */
export const EXCHANGE_USER_EVENTS = "user.events";
export const QUEUE_USER_CREATED_CATALOG = "catalog.user_created";
