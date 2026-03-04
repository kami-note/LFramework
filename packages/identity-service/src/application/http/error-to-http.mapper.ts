import type { HttpErrorMapping } from "@lframework/shared";
import {
  UserAlreadyExistsError,
  InvalidCredentialsError,
  InvalidEmailError,
  PasswordValidationError,
} from "../errors";

const DEFAULT: HttpErrorMapping = { statusCode: 500, message: "Internal server error" };

/**
 * Mapeia erros de aplicação/domínio para resposta HTTP (status + mensagem).
 * Centraliza as regras em um único lugar (SRP); controllers só orquestram.
 */
export function mapApplicationErrorToHttp(err: unknown): HttpErrorMapping {
  if (err instanceof UserAlreadyExistsError) {
    return { statusCode: 409, message: err.message };
  }
  if (err instanceof InvalidCredentialsError) {
    return { statusCode: 401, message: err.message };
  }
  if (err instanceof InvalidEmailError || err instanceof PasswordValidationError) {
    return { statusCode: 400, message: err.message };
  }
  return DEFAULT;
}
