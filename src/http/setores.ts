import { Router } from 'express';
import type { Repositorio } from '../data/repositorio';

// Departamentos/setores — dado de referência para o filtro e os formulários.
export function montarSetores(repo: Repositorio): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await repo.departamentos.listar());
  });
  return r;
}
