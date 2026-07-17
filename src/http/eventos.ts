import { Router } from 'express';
import { autenticar, exigirAdmin } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { atualizarEventoSchema, criarEventoSchema } from '../domain/evento';
import { auditar, idParam, validar } from './util';

// Agenda: leitura pública (card "Próximos eventos"); gestão só para o admin.
export function montarEventos(repo: Repositorio): Router {
  const r = Router();

  r.get('/', async (_req, res) => {
    res.json(await repo.eventos.listar());
  });

  r.post('/', autenticar, exigirAdmin, validar(criarEventoSchema), async (req, res) => {
    const evento = await repo.eventos.criar(req.body);
    await auditar(repo, req, 'criou', 'evento', evento.titulo);
    res.status(201).json(evento);
  });

  r.put('/:id', autenticar, exigirAdmin, validar(atualizarEventoSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const evento = await repo.eventos.atualizar(id, req.body);
    await auditar(repo, req, 'editou', 'evento', evento.titulo);
    res.json(evento);
  });

  r.delete('/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    await repo.eventos.remover(id);
    await auditar(repo, req, 'excluiu', 'evento', `id ${id}`);
    res.json({ ok: true });
  });

  return r;
}
