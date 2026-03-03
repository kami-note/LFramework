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

  constructor(private readonly connection: AmqpConnection) {}

  onUserCreated(fn: UserCreatedHandler): void {
    this.handler = fn;
  }

  async start(): Promise<void> {
    const ch = await this.connection.createChannel();
    await ch.assertExchange(EXCHANGE_USER_EVENTS, "topic", { durable: true });
    await ch.assertQueue(QUEUE_USER_CREATED_CATALOG, { durable: true });
    await ch.bindQueue(
      QUEUE_USER_CREATED_CATALOG,
      EXCHANGE_USER_EVENTS,
      "user_created"
    );

    await ch.consume(QUEUE_USER_CREATED_CATALOG, async (msg: ConsumeMessage | null) => {
      if (!msg || !this.handler) return;
      try {
        const body = JSON.parse(msg.content.toString());
        if (body.type === USER_CREATED_EVENT && body.payload) {
          const { userId, email, name } = body.payload;
          await this.handler({ userId, email, name });
        }
        ch.ack(msg);
      } catch (err) {
        console.error("Error processing UserCreated:", err);
        ch.nack(msg, false, true);
      }
    });
  }
}
