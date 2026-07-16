import { Router } from 'express';
import { autenticar, exigirAdmin } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { atualizarSetorSchema, criarSetorSchema } from '../domain/departamento';
import { idParam, validar } from './util';

// Setores/departamentos — leitura pública (filtros e formulários); gestão só
// para o admin. Renomear a sigla cascateia para as pessoas; excluir é
// bloqueado enquanto houver pessoa no setor (409).
export function montarSetores(repo: Repositorio): Router {
  const r = Router();

  r.get('/', async (_req, res) => {
    res.json(await repo.departamentos.listar());
  });

  r.post('/', autenticar, exigirAdmin, validar(criarSetorSchema), async (req, res) => {
    res.status(201).json(await repo.departamentos.criar(req.body));
  });

  r.put('/:id', autenticar, exigirAdmin, validar(atualizarSetorSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    res.json(await repo.departamentos.atualizar(id, req.body));
  });

  r.delete('/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    await repo.departamentos.remover(id);
    res.json({ ok: true });
  });

  return r;
}
