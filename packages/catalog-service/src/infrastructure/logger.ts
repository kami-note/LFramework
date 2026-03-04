import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Logger estruturado (Pino).
 * Em produção: JSON. Em desenvolvimento: pretty (pino-pretty).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }),
});
