/**
 * Erro base para erros de aplicação/domínio.
 * Contrato: name, message (herdados de Error), código opcional.
 * Subclasses devem definir `name` para instanceof e serialização.
 */
export class AppError extends Error {
  override name = "AppError";
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
