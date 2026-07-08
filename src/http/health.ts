import { Router } from 'express';

export function montarHealth(): Router {
  const r = Router();
  r.get('/', (_req, res) => {
    res.json({ status: 'ok' });
  });
  return r;
}
