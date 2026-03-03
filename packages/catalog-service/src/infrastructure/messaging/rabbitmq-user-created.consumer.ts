import amqp, { ConsumeMessage } from "amqplib";
import {
  USER_CREATED_EVENT,
  EXCHANGE_USER_EVENTS,
  QUEUE_USER_CREATED_CATALOG,
} from "@lframework/shared";

export type UserCreatedHandler = (payload: {
  userId: string;
  email: string;
  name: string;
}) => Promise<void>;

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

/**
 * Adapter: consome evento UserCreated do RabbitMQ e chama o handler registrado.
 */
export class RabbitMqUserCreatedConsumer {
  private handler: UserCreatedHandler | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private readonly connection: AmqpConnection) {}

  onUserCreated(fn: UserCreatedHandler): void {
    this.handler = fn;
  }

  async start(): Promise<void> {
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EXCHANGE_USER_EVENTS, "topic", { durable: true });
    await this.channel.assertQueue(QUEUE_USER_CREATED_CATALOG, { durable: true });
    await this.channel.bindQueue(
      QUEUE_USER_CREATED_CATALOG,
      EXCHANGE_USER_EVENTS,
      "user_created"
    );

    await this.channel.consume(QUEUE_USER_CREATED_CATALOG, async (msg: ConsumeMessage | null) => {
      if (!msg || !this.handler || !this.channel) return;
      try {
        const body = JSON.parse(msg.content.toString());
        if (body.type === USER_CREATED_EVENT && body.payload) {
          const { userId, email, name } = body.payload;
          await this.handler({ userId, email, name });
        }
        this.channel.ack(msg);
      } catch (err) {
        console.error("Error processing UserCreated:", err);
        this.channel.nack(msg, false, true);
      }
    });
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    await this.connection.close();
  }
}
