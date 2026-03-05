import { Request, Response, NextFunction } from "express";

/**
 * Handler async aceito: (req, res) ou (req, res, next) => Promise<void>.
 * Envolve para que rejeições de Promise sejam passadas a next(err),
 * permitindo que o middleware de erro (4 argumentos) as trate. Express 4 não faz isso automaticamente.
 */
export type AsyncRequestHandler<R = Request> =
  | ((req: R, res: Response, next: NextFunction) => Promise<void>)
  | ((req: R, res: Response) => Promise<void>);

export function asyncHandler<R = Request>(
  fn: AsyncRequestHandler<R>
): (req: R, res: Response, next: NextFunction) => void {
  return (req: R, res: Response, next: NextFunction) => {
    Promise.resolve((fn as (req: R, res: Response, next: NextFunction) => Promise<void>)(req, res, next)).catch(next);
  };
}
