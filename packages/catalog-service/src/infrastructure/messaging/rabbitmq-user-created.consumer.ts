import amqp, { ConsumeMessage } from "amqplib";
import { z } from "zod";
import type { UserCreatedPayload } from "@lframework/shared";
import {
  USER_CREATED_EVENT,
  EXCHANGE_USER_EVENTS,
  QUEUE_USER_CREATED_CATALOG,
  nameSchema,
  logger,
} from "@lframework/shared";

/** Não confiamos no publisher: validamos payload com as mesmas regras de nome/email e occurredAt. */

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

const userCreatedPayloadSchema = z.object({
  userId: z.string().min(1, "userId required").max(64),
  email: z
    .string()
    .min(1)
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => s.length <= MAX_EMAIL_LENGTH, "email too long")
    .refine((s) => !s.includes("<") && !s.includes(">"), "Invalid email")
    .refine((s) => EMAIL_FORMAT.test(s), "Invalid email"),
  name: nameSchema,
  occurredAt: z
    .string()
    .min(1, "occurredAt required")
    .refine(
      (s) => {
        const date = new Date(s);
        return !isNaN(date.getTime());
      },
      { message: "occurredAt must be valid ISO 8601 date" }
    )
    .transform((s) => new Date(s).toISOString()),
});

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

/**
 * Adapter: consome evento UserCreated do RabbitMQ e chama o handler registrado.
 */
export class RabbitMqUserCreatedConsumer {
  private handler: ((payload: UserCreatedPayload) => Promise<void>) | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private readonly connection: AmqpConnection) {}

  onUserCreated(fn: (payload: UserCreatedPayload) => Promise<void>): void {
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
        if (body.type !== USER_CREATED_EVENT || !body.payload) {
          this.channel.ack(msg);
          return;
        }
        const parsed = userCreatedPayloadSchema.safeParse(body.payload);
        if (!parsed.success) {
          logger.warn({ validation: parsed.error.flatten() }, "Invalid UserCreated payload");
          this.channel.nack(msg, false, false);
          return;
        }
        const payload: UserCreatedPayload = parsed.data;
        await this.handler(payload);
        this.channel.ack(msg);
      } catch (err) {
        logger.error({ err }, "Error processing UserCreated");
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
