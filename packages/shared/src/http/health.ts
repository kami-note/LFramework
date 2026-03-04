import type { Request, Response } from "express";
import type { HealthResponseDto } from "../dtos";

/**
 * Path recomendado: GET /health. Contrato: { status: string, service: string }.
 * Retorna um handler Express que responde 200 com body compatível com HealthResponseDto.
 */
export function createHealthHandler(serviceName: string): (req: Request, res: Response) => void {
  return (_req: Request, res: Response) => {
    const body: HealthResponseDto = { status: "ok", service: serviceName };
    res.status(200).json(body);
  };
}
