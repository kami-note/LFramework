import type { Request } from "express";

const defaultHeaders: Request["headers"] = {};
const defaultParams: Request["params"] = {};
const defaultQuery: Request["query"] = {};
const defaultBody: Request["body"] = undefined;

/**
 * Cria um objeto mock de Express Request para uso em testes.
 * Retorna um Request com defaults vazios; overrides são fundidos em cima.
 * Evita "req as any" e deixa os testes tipados.
 *
 * @param overrides - propriedades a sobrescrever (headers, params, body, query, etc.)
 * @returns objeto que satisfaz Request para uso em middlewares/controllers
 */
export function createMockRequest(
  overrides: Partial<Request> = {}
): Request {
  const { headers, params, query, body, ...rest } = overrides;
  const req = {
    ...rest,
    headers: { ...defaultHeaders, ...(headers ?? {}) },
    params: { ...defaultParams, ...(params ?? {}) },
    query: { ...defaultQuery, ...(query ?? {}) },
    body: body !== undefined ? body : defaultBody,
  };
  return req as Request;
}
