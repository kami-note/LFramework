import amqp from "amqplib";
import type { IEventPublisher } from "../../application/ports/event-publisher.port";
import { EXCHANGE_USER_EVENTS } from "@lframework/shared";

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

/**
 * Adapter: publicador de eventos via RabbitMQ.
 */
export class RabbitMqEventPublisher implements IEventPublisher {
  private channel: amqp.Channel | null = null;

  constructor(
    private readonly connection: AmqpConnection,
    private readonly exchange: string = EXCHANGE_USER_EVENTS
  ) {}

  async ensureChannel(): Promise<amqp.Channel> {
    if (this.channel) return this.channel;
    const ch = await this.connection.createChannel();
    this.channel = ch;
    await this.channel.assertExchange(this.exchange, "topic", { durable: true });
    return this.channel;
  }

  async publish(eventName: string, payload: object): Promise<void> {
    const ch = await this.ensureChannel();
    const routingKey = eventName.replace(".", "_");
    const message = Buffer.from(JSON.stringify({ type: eventName, payload }));
    ch.publish(this.exchange, routingKey, message, { persistent: true });
  }
}
