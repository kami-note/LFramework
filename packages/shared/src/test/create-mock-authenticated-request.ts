import type { Request } from "express";
import type { AuthenticatedRequest } from "../http/auth.middleware";
import { createMockRequest } from "./create-mock-request";

/**
 * Cria um objeto mock de Express Request com userId para testes de rotas autenticadas.
 * Evita "req as any" em testes que chamam controllers que esperam AuthenticatedRequest.
 *
 * @param overrides - propriedades a sobrescrever (userId obrigatório, além de headers, params, body, query, etc.)
 * @returns objeto que satisfaz AuthenticatedRequest
 */
export function createMockAuthenticatedRequest(
  overrides: Partial<Request> & { userId: string }
): AuthenticatedRequest {
  const { userId, ...rest } = overrides;
  const req = createMockRequest(rest);
  return { ...req, userId } as AuthenticatedRequest;
}
