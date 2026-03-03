import amqp from "amqplib";
import type { IEventConsumer } from "../../application/ports/event-consumer.port";
import { RabbitMqUserCreatedConsumer } from "./rabbitmq-user-created.consumer";

/**
 * Adapter que implementa IEventConsumer usando RabbitMQ.
 * Encapsula conexão e ciclo de vida (start/close) para uso no container.
 */
export class RabbitMqUserEventsAdapter implements IEventConsumer {
  private handler: ((payload: { userId: string; email: string; name: string }) => Promise<void>) | null = null;
  private consumer: RabbitMqUserCreatedConsumer | null = null;

  constructor(private readonly rabbitmqUrl: string) {}

  onUserCreated(handler: (payload: { userId: string; email: string; name: string }) => Promise<void>): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    if (!this.handler) {
      throw new Error("Registre o handler com onUserCreated() antes de start()");
    }
    const connection = await amqp.connect(this.rabbitmqUrl);
    this.consumer = new RabbitMqUserCreatedConsumer(connection);
    this.consumer.onUserCreated(this.handler);
    await this.consumer.start();
  }

  async close(): Promise<void> {
    if (this.consumer) {
      await this.consumer.close();
      this.consumer = null;
    }
  }
}
