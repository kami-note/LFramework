/**
 * Fetch com timeout via AbortSignal.
 * Usado em chamadas OAuth (Google/GitHub) para evitar espera indefinida.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Combina dois AbortSignals num só que aborta quando qualquer um abortar.
 * Compatível com Node 18 (AbortSignal.any só em Node 20+).
 */
function combineAbortSignals(
  a: AbortSignal,
  b: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const combined = new AbortController();
  const onA = (): void => combined.abort(a.reason);
  const onB = (): void => combined.abort(b.reason);
  a.addEventListener("abort", onA);
  b.addEventListener("abort", onB);
  return {
    signal: combined.signal,
    cleanup: () => {
      a.removeEventListener("abort", onA);
      b.removeEventListener("abort", onB);
    },
  };
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let signal: AbortSignal;
  let cleanup: (() => void) | undefined;
  if (init?.signal) {
    const result = combineAbortSignals(controller.signal, init.signal);
    signal = result.signal;
    cleanup = result.cleanup;
  } else {
    signal = controller.signal;
  }

  try {
    const res = await fetch(url, {
      ...init,
      signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
    cleanup?.();
  }
}

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;

const NODE_NETWORK_ERROR_CODES = ["ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "ECONNREFUSED"] as const;

/**
 * Indica se o erro é de rede/abort e deve ser considerado retentável.
 * Usa tipo/nome e códigos explícitos em vez de inspecionar err.message.
 */
function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError") return true;
  if (err.name === "TypeError" || err.name === "FetchError") return true;
  if (typeof DOMException !== "undefined" && err instanceof DOMException) return true;
  const code = (err as NodeJS.ErrnoException).code;
  return typeof code === "string" && (NODE_NETWORK_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Fetch com timeout e um retry em caso de falha de rede (AbortError ou TypeError de rede).
 * Usado nas chamadas OAuth para maior resiliência.
 */
export async function fetchWithTimeoutAndRetry(
  url: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, init, timeoutMs);
    } catch (err) {
      const isRetryable = isRetryableNetworkError(err);
      if (attempt < maxRetries && isRetryable) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable"); // Satisfies TS; loop always returns or throws
}
