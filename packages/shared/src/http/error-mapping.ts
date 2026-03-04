/**
 * Contrato compartilhado para mapeamento erro de aplicação → resposta HTTP.
 * Cada microserviço implementa sua própria função mapApplicationErrorToHttp(err)
 * e retorna este tipo; controllers usam statusCode e message com sendError(res, statusCode, message).
 * Ver docs/DESIGN_PATTERNS.md — padrão "Error-to-HTTP mapper".
 */
export interface HttpErrorMapping {
  statusCode: number;
  message: string;
}
