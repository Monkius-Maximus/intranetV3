import { Router } from 'express';
import { autenticar, exigirAdmin } from '../auth';
import type { Repositorio } from '../data/repositorio';

// Trilha de auditoria — leitura só para administradores.
export function montarAuditoria(repo: Repositorio): Router {
  const r = Router();
  r.get('/', autenticar, exigirAdmin, async (req, res) => {
    const limite = Math.min(Number(req.query.limite) || 200, 1000);
    res.json(await repo.auditoria.listar(limite));
  });
  return r;
}
