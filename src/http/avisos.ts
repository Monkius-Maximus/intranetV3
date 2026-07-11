import { Router } from 'express';
import { type AuthedRequest, autenticar, exigirAdmin } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { atualizarAvisoSchema, criarAvisoSchema } from '../domain/aviso';
import { idParam, validar } from './util';

export function montarAvisos(repo: Repositorio): Router {
  const r = Router();

  r.get('/', async (_req, res) => {
    res.json(await repo.avisos.listar());
  });

  r.post('/', autenticar, exigirAdmin, validar(criarAvisoSchema), async (req: AuthedRequest, res) => {
    res
      .status(201)
      .json(await repo.avisos.criar({ ...req.body, createdBy: req.user!.sub, autor: req.user!.name ?? null }));
  });

  r.put('/:id', autenticar, exigirAdmin, validar(atualizarAvisoSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    res.json(await repo.avisos.atualizar(id, req.body));
  });

  r.delete('/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    res.json(await repo.avisos.remover(id));
  });

  return r;
}
