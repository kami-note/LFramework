/**
 * Erro base para erros de aplicação/domínio.
 * Subclasses devem definir `name` para instanceof e serialização.
 */
export class AppError extends Error {
  override name = "AppError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
