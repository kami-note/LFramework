import amqp from "amqplib";
import type { IEventPublisher } from "../../application/ports/event-publisher.port";
import { RabbitMqEventPublisher } from "./rabbitmq-event-publisher";

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

/**
 * Facade que encapsula conexão RabbitMQ e publicador de eventos.
 * Centraliza connect/disconnect e implementa IEventPublisher para o use case.
 */
export class RabbitMqMessagingFacade implements IEventPublisher {
  private connection: AmqpConnection | null = null;
  private publisher: RabbitMqEventPublisher | null = null;

  constructor(private readonly rabbitmqUrl: string) {}

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.rabbitmqUrl);
    this.publisher = new RabbitMqEventPublisher(this.connection);
  }

  async publish(eventName: string, payload: object): Promise<void> {
    if (!this.publisher) {
      throw new Error("MessagingFacade não conectado; chame connect() antes de publicar.");
    }
    await this.publisher.publish(eventName, payload);
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.publisher = null;
    }
  }
}
