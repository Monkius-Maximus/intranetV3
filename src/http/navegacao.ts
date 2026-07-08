import { Router } from 'express';
import { autenticar, exigirAdmin } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { criarGrupoSchema, criarItemSchema, reordenarSchema } from '../domain/navegacao';
import { idParam, validar } from './util';

// Navegação dirigida por banco: admin adiciona/remove/reordena grupos e itens
// sem tocar em código. Leitura é pública (monta a barra e os cards).
export function montarNavegacao(repo: Repositorio): Router {
  const r = Router();

  r.get('/', async (_req, res) => {
    res.json(await repo.navegacao.arvore());
  });

  r.post('/grupos', autenticar, exigirAdmin, validar(criarGrupoSchema), async (req, res) => {
    res.status(201).json(await repo.navegacao.criarGrupo(req.body));
  });

  r.put('/grupos/ordem', autenticar, exigirAdmin, validar(reordenarSchema), async (req, res) => {
    await repo.navegacao.reordenarGrupos(req.body.ids);
    res.json({ ok: true });
  });

  r.delete('/grupos/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    await repo.navegacao.removerGrupo(id);
    res.json({ ok: true });
  });

  r.put('/grupos/:id/itens/ordem', autenticar, exigirAdmin, validar(reordenarSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    await repo.navegacao.reordenarItens(id, req.body.ids);
    res.json({ ok: true });
  });

  r.post('/itens', autenticar, exigirAdmin, validar(criarItemSchema), async (req, res) => {
    res.status(201).json(await repo.navegacao.criarItem(req.body));
  });

  r.delete('/itens/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    await repo.navegacao.removerItem(id);
    res.json({ ok: true });
  });

  return r;
}
