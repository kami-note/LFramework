import amqp from "amqplib";
import type { UserCreatedPayload } from "@lframework/shared";
import type { IEventConsumer } from "../../../../application/ports/event-consumer.port";
import { RabbitMqUserCreatedConsumer } from "./rabbitmq-user-created.consumer";

/**
 * Adapter que implementa IEventConsumer usando RabbitMQ.
 * Encapsula conexão e ciclo de vida (start/close) para uso no container.
 */
export class RabbitMqUserEventsAdapter implements IEventConsumer {
  private handler: ((payload: UserCreatedPayload) => Promise<void>) | null = null;
  private consumer: RabbitMqUserCreatedConsumer | null = null;

  /** Timeout de conexão em ms (evita espera indefinida se o broker estiver indisponível). */
  private static readonly CONNECT_TIMEOUT_MS = 10_000;

  constructor(private readonly rabbitmqUrl: string) {}

  onUserCreated(handler: (payload: UserCreatedPayload) => Promise<void>): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    if (!this.handler) {
      throw new Error("Registre o handler com onUserCreated() antes de start()");
    }
    const connection = await amqp.connect(this.rabbitmqUrl, {
      timeout: RabbitMqUserEventsAdapter.CONNECT_TIMEOUT_MS,
    });
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
