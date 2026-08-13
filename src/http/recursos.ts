import { Router } from 'express';
import { autenticar, exigirAdmin } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { atualizarRecursoSchema, criarRecursoSchema } from '../domain/recurso';
import { auditar, idParam, validar } from './util';

// DEFINIÇÃO dos recursos dirigidos por dados ("CRUD de página"). Leitura é
// pública porque a interface precisa da definição para desenhar o menu e as
// telas antes de qualquer login; criar/editar/excluir é só do admin.
//
// Os REGISTROS (o conteúdo de cada recurso) ficam em http/registros.ts.
export function montarRecursos(repo: Repositorio): Router {
  const r = Router();

  r.get('/', async (_req, res) => {
    res.json(await repo.recursos.listar());
  });

  r.post('/', autenticar, exigirAdmin, validar(criarRecursoSchema), async (req, res) => {
    const recurso = await repo.recursos.criar(req.body);
    await auditar(repo, req, 'criou', 'recurso', `${recurso.nome} (${recurso.chave})`);
    res.status(201).json(recurso);
  });

  r.put('/:id', autenticar, exigirAdmin, validar(atualizarRecursoSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const recurso = await repo.recursos.atualizar(id, req.body);
    await auditar(repo, req, 'editou', 'recurso', `${recurso.nome} (${recurso.chave})`);
    res.json(recurso);
  });

  // Excluir leva junto os registros — por isso a rota devolve quantos foram,
  // e a tela avisa o número antes de confirmar.
  r.delete('/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const { recurso, registros } = await repo.recursos.remover(id);
    await auditar(repo, req, 'excluiu', 'recurso', `${recurso.nome} (${registros} registro(s))`);
    res.json({ ok: true, registrosRemovidos: registros });
  });

  r.post('/ordem', autenticar, exigirAdmin, async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
    await repo.recursos.reordenar(ids);
    res.json({ ok: true });
  });

  return r;
}
