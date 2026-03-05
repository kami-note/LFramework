import amqp, { ConsumeMessage } from "amqplib";
import { LRUCache } from "lru-cache";
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

/**
 * Número máximo de tentativas de processamento antes de descartar a mensagem.
 * Após MAX_RETRIES falhas consecutivas (no mesmo worker), a mensagem é descartada
 * (nack sem requeue) e logada para inspeção, evitando loop infinito por falha persistente.
 */
const MAX_RETRIES = 5;

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
 * Em falha de processamento: requeue até MAX_RETRIES vezes; após isso, descarta a mensagem
 * (nack sem requeue) e loga para inspeção, evitando loop infinito.
 */
export class RabbitMqUserCreatedConsumer {
  private handler: ((payload: UserCreatedPayload) => Promise<void>) | null = null;
  private channel: amqp.Channel | null = null;
  /** Contador de retries por chave da mensagem (content). Após MAX_RETRIES, descartamos sem requeue. */
  private readonly retryCountByMessageKey = new LRUCache<string, number>({
    max: 10_000,
    ttl: 1000 * 60 * 60, // 1 hora; entradas expiram se não acessadas
  });

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
        this.retryCountByMessageKey.delete(msg.content.toString());
        this.channel.ack(msg);
      } catch (err) {
        const messageKey = msg.content.toString();
        const count = (this.retryCountByMessageKey.get(messageKey) ?? 0) + 1;
        this.retryCountByMessageKey.set(messageKey, count);

        if (count >= MAX_RETRIES) {
          logger.error(
            { err, retries: count, messageKey: messageKey.slice(0, 200) },
            "UserCreated message discarded after MAX_RETRIES attempts (no requeue)"
          );
          this.retryCountByMessageKey.delete(messageKey);
          this.channel.nack(msg, false, false);
        } else {
          logger.warn({ err, retry: count, maxRetries: MAX_RETRIES }, "Error processing UserCreated, requeuing");
          this.channel.nack(msg, false, true);
        }
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
