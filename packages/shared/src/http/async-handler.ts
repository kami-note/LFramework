import { Request, Response, NextFunction } from "express";

/**
 * Envolve um handler async para que rejeições de Promise sejam passadas a next(err),
 * permitindo que o middleware de erro (4 argumentos) as trate. Express 4 não faz isso automaticamente.
 */
export function asyncHandler<R = Request>(
  fn: (req: R, res: Response, next: NextFunction) => Promise<void>
): (req: R, res: Response, next: NextFunction) => void {
  return (req: R, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
