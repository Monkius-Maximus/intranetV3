import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

// Middleware único de validação de formato (uma forma só de validar).
export function validar<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      res.status(422).json({ erro: 'validação falhou', detalhes: r.error.issues });
      return;
    }
    req.body = r.data;
    next();
  };
}

export function idParam(req: Request, res: Response): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ erro: 'id inválido' });
    return null;
  }
  return id;
}
