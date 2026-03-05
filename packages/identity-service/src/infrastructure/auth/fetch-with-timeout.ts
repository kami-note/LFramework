/**
 * Fetch com timeout via AbortSignal.
 * Usado em chamadas OAuth (Google/GitHub) para evitar espera indefinida.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;

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
      const isRetryable =
        err instanceof Error &&
        (err.name === "AbortError" || err.message?.includes("fetch") || err.message?.includes("network"));
      if (attempt < maxRetries && isRetryable) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable"); // Satisfies TS; loop always returns or throws
}
