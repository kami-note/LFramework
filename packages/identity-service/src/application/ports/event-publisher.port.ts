/**
 * Porta: publicador de eventos (ex.: RabbitMQ).
 * Implementação em infrastructure/messaging.
 */
export interface IEventPublisher {
  publish(eventName: string, payload: object): Promise<void>;
}
