import { NextFunction, Request, Response } from 'express';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Express 4 does not forward rejected promises to the error middleware on its
// own. This wrapper does, so route handlers can be written as plain async
// functions and still surface failures (e.g. the database being down).
export function asyncHandler(fn: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
