/**
 * Porta: consumidor de eventos (ex.: RabbitMQ).
 * O application registra handlers; o adapter RabbitMQ chama quando mensagem chega.
 */
export interface IEventConsumer {
  onUserCreated(handler: (payload: { userId: string; email: string; name: string }) => Promise<void>): void;
}
