import { Router } from 'express';
import { autenticar, exigirAdmin } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { atualizarEventoSchema, criarEventoSchema } from '../domain/evento';
import { idParam, validar } from './util';

// Agenda: leitura pública (card "Próximos eventos"); gestão só para o admin.
export function montarEventos(repo: Repositorio): Router {
  const r = Router();

  r.get('/', async (_req, res) => {
    res.json(await repo.eventos.listar());
  });

  r.post('/', autenticar, exigirAdmin, validar(criarEventoSchema), async (req, res) => {
    res.status(201).json(await repo.eventos.criar(req.body));
  });

  r.put('/:id', autenticar, exigirAdmin, validar(atualizarEventoSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    res.json(await repo.eventos.atualizar(id, req.body));
  });

  r.delete('/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    await repo.eventos.remover(id);
    res.json({ ok: true });
  });

  return r;
}
