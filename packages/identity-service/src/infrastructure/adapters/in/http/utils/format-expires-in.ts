/**
 * Formata duração em segundos para string legível (ex: "1d", "2h", "30m", "45s").
 * Valores inválidos (NaN, infinito, negativos) retornam "0s".
 */
export function formatExpiresIn(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0s";
  if (seconds >= 86400) return `${Math.round(seconds / 86400)}d`;
  if (seconds >= 3600) return `${Math.round(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}
