import { Router } from 'express';
import { autenticar, exigirAdmin } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { reordenarSchema } from '../domain/navegacao';
import { atualizarTileSchema, CORES_TILE, criarTileSchema, ICONES_TILE } from '../domain/tile';
import { idParam, validar } from './util';

// Tiles de "Acesso rápido" — leitura pública (montam o dashboard); gestão
// (criar/editar/reordenar/excluir) só para o admin.
export function montarTiles(repo: Repositorio): Router {
  const r = Router();

  r.get('/', async (_req, res) => {
    res.json(await repo.tiles.listar());
  });

  // Opções válidas para o editor (fonte única: domain/tile.ts).
  r.get('/opcoes', (_req, res) => {
    res.json({ icones: ICONES_TILE, cores: CORES_TILE });
  });

  r.post('/', autenticar, exigirAdmin, validar(criarTileSchema), async (req, res) => {
    res.status(201).json(await repo.tiles.criar(req.body));
  });

  r.put('/ordem', autenticar, exigirAdmin, validar(reordenarSchema), async (req, res) => {
    await repo.tiles.reordenar(req.body.ids);
    res.json({ ok: true });
  });

  r.put('/:id', autenticar, exigirAdmin, validar(atualizarTileSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    res.json(await repo.tiles.atualizar(id, req.body));
  });

  r.delete('/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    await repo.tiles.remover(id);
    res.json({ ok: true });
  });

  return r;
}
