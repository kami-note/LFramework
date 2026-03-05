import amqp from "amqplib";
import type { IEventPublisher } from "../../application/ports/event-publisher.port";
import { EXCHANGE_USER_EVENTS } from "@lframework/shared";

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

/**
 * Adapter: publicador de eventos via RabbitMQ.
 * Encapsula conexão, canal e ciclo de vida (connect/disconnect); implementa IEventPublisher.
 */
export class RabbitMqEventPublisherAdapter implements IEventPublisher {
  private connection: AmqpConnection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly exchange = EXCHANGE_USER_EVENTS;

  /** Timeout de conexão em ms (evita espera indefinida se o broker estiver indisponível). */
  private static readonly CONNECT_TIMEOUT_MS = 10_000;

  constructor(private readonly rabbitmqUrl: string) {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.rabbitmqUrl, {
      timeout: RabbitMqEventPublisherAdapter.CONNECT_TIMEOUT_MS,
    });
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(this.exchange, "topic", { durable: true });
  }

  async publish(eventName: string, payload: object): Promise<void> {
    if (!this.channel) {
      throw new Error("RabbitMqEventPublisherAdapter não conectado; chame connect() antes de publicar.");
    }
    const routingKey = eventName.replace(".", "_");
    const message = Buffer.from(JSON.stringify({ type: eventName, payload }));
    this.channel.publish(this.exchange, routingKey, message, { persistent: true });
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}
