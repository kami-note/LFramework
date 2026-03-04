import type { HttpErrorMapping } from "./error-mapping";

/** Construtor de subclasse de Error (message opcional; aceita erros de aplicação). */
type ErrorCtor = new (message?: string, ...rest: unknown[]) => Error;

const DEFAULT: HttpErrorMapping = { statusCode: 500, message: "Internal server error" };

/**
 * Cria uma função que mapeia erros de aplicação para resposta HTTP.
 * Cada serviço passa seus erros e status codes; erros desconhecidos retornam o default.
 */
export function createErrorToHttpMapper(
  mappings: Array<[ErrorCtor, number]>,
  defaultMapping: HttpErrorMapping = DEFAULT
): (err: unknown) => HttpErrorMapping {
  return (err: unknown): HttpErrorMapping => {
    for (const [Ctor, statusCode] of mappings) {
      if (err instanceof Ctor) {
        return { statusCode, message: (err as Error).message };
      }
    }
    return defaultMapping;
  };
}
