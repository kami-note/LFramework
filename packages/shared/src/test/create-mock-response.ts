import type { Response } from "express";
import { vi } from "vitest";

/**
 * Cria um objeto mock de Express Response para uso em testes.
 * Inclui status (mockReturnThis), json, setHeader, headersSent: false.
 * Evita "res as Response" e deixa os testes tipados.
 *
 * @returns objeto que satisfaz Response para uso em middlewares/controllers
 */
export function createMockResponse(): Response {
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn(),
    send: vi.fn(),
    end: vi.fn(),
  };
  return res as unknown as Response;
}
