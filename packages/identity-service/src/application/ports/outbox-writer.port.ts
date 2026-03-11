/**
 * Event to be stored in the outbox (same transaction as business data).
 * Consumed by the outbox relay for publishing to the message broker.
 */
export interface OutboxEvent {
  eventName: string;
  payload: object;
}
