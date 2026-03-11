import amqp, { ConsumeMessage } from "amqplib";
import { LRUCache } from "lru-cache";
import { z } from "zod";
import type { UserCreatedPayload } from "@lframework/shared";
import {
  USER_CREATED_EVENT,
  EXCHANGE_USER_EVENTS,
  QUEUE_USER_CREATED_CATALOG,
  QUEUE_USER_CREATED_CATALOG_FAILED,
  nameSchema,
  logger,
} from "@lframework/shared";

/** Não confiamos no publisher: validamos payload com as mesmas regras de nome/email e occurredAt. */

/**
 * Número máximo de tentativas de processamento antes de enviar para a fila de falhas.
 * Após MAX_RETRIES falhas, a mensagem é enviada para QUEUE_USER_CREATED_CATALOG_FAILED
 * (nack sem requeue) e logada para inspeção.
 */
const MAX_RETRIES = 5;

/** Base do backoff exponencial (ms). delay = RETRY_BASE_MS * 2^(count-1). */
const RETRY_BASE_MS = 2000;

const RETRY_HEADER = "x-retry-count";

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
 * Em falha de processamento: republish com backoff exponencial (delay = RETRY_BASE_MS * 2^(count-1))
 * até MAX_RETRIES vezes; o contador vem do header x-retry-count ou do cache em memória.
 * Após MAX_RETRIES, envia a mensagem para QUEUE_USER_CREATED_CATALOG_FAILED e faz nack sem requeue.
 */
export class RabbitMqUserCreatedConsumer {
  private handler: ((payload: UserCreatedPayload) => Promise<void>) | null = null;
  private channel: amqp.Channel | null = null;
  /** Contador de retries por chave da mensagem (content). Após MAX_RETRIES, descartamos sem requeue. */
  private readonly retryCountByMessageKey = new LRUCache<string, number>({
    max: 10_000,
    ttl: 1000 * 60 * 60, // 1 hora; entradas expiram se não acessadas
  });
  /** IDs de timeouts de republish pendentes para limpar em close(). */
  private readonly pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

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
    await this.channel.assertQueue(QUEUE_USER_CREATED_CATALOG_FAILED, { durable: true });

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
        const prevCount =
          (typeof msg.properties?.headers?.[RETRY_HEADER] === "number"
            ? msg.properties.headers[RETRY_HEADER]
            : this.retryCountByMessageKey.get(messageKey)) ?? 0;
        const count = prevCount + 1;
        this.retryCountByMessageKey.set(messageKey, count);

        if (count >= MAX_RETRIES) {
          logger.error(
            { err, retries: count, messageKey: messageKey.slice(0, 200) },
            "UserCreated message sent to failed queue after MAX_RETRIES attempts (no requeue)"
          );
          const headers = { ...(msg.properties?.headers || {}), [RETRY_HEADER]: count };
          this.channel.sendToQueue(QUEUE_USER_CREATED_CATALOG_FAILED, msg.content, { headers });
          this.retryCountByMessageKey.delete(messageKey);
          this.channel.nack(msg, false, false);
        } else {
          const delayMs = RETRY_BASE_MS * 2 ** (count - 1);
          logger.warn(
            { err, retry: count, maxRetries: MAX_RETRIES, delayMs },
            "Error processing UserCreated, will republish after exponential backoff"
          );
          const contentCopy = Buffer.from(msg.content);
          const headers = { ...(msg.properties?.headers || {}), [RETRY_HEADER]: count };
          const timeoutId = setTimeout(() => {
            this.pendingTimeouts.delete(timeoutId);
            if (!this.channel) return;
            try {
              this.channel.publish(EXCHANGE_USER_EVENTS, "user_created", contentCopy, { headers });
              try {
                this.channel.nack(msg, false, false);
              } catch (nackErr) {
                logger.error(
                  { err: nackErr },
                  "Nack after successful republish failed (channel may be closed); not requeueing to avoid duplicates"
                );
              }
            } catch (publishErr) {
              logger.error({ err: publishErr, retry: count }, "Failed to republish UserCreated after backoff");
              try {
                this.channel.nack(msg, false, true);
              } catch (nackErr) {
                logger.error({ err: nackErr }, "Nack after republish failure failed (channel may be closed)");
              }
            }
          }, delayMs);
          this.pendingTimeouts.add(timeoutId);
        }
      }
    });
  }

  async close(): Promise<void> {
    for (const id of this.pendingTimeouts) {
      clearTimeout(id);
    }
    this.pendingTimeouts.clear();
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
    await this.connection.close();
  }
}
