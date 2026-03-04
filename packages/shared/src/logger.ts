import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Resolve transport para desenvolvimento: usa pino-pretty se estiver instalado,
 * senão fallback para JSON no stdout (mesmo comportamento que produção).
 * O valor de NODE_ENV é lido uma vez no carregamento do módulo; mudanças em
 * runtime não alteram o transport.
 */
function getDevTransport(): pino.TransportTargetOptions | undefined {
  if (isProduction) return undefined;
  try {
    require.resolve("pino-pretty");
    return {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    };
  } catch {
    return undefined;
  }
}

const transport = getDevTransport();

/**
 * Logger estruturado (Pino).
 * - Produção: sempre JSON no stdout.
 * - Desenvolvimento: pretty (pino-pretty) se o pacote estiver instalado;
 *   caso contrário, JSON no stdout. Quem usar apenas @lframework/shared sem
 *   pino-pretty em dev não precisa instalá-lo.
 *
 * Nota de segurança: não logar req, headers ou body sem sanitização (evitar
 * vazamento de tokens, PII ou dados sensíveis).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  ...(transport ? { transport } : {}),
});
