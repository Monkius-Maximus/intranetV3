import { Router } from 'express';
import { autenticar, exigirAdmin } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { atualizarSetorSchema, criarSetorSchema, moverPessoasSchema } from '../domain/departamento';
import { auditar, idParam, validar } from './util';

// Setores/departamentos — leitura pública (filtros e formulários); gestão só
// para o admin. Renomear a sigla cascateia para as pessoas; excluir é
// bloqueado enquanto houver pessoa no setor (409).
export function montarSetores(repo: Repositorio): Router {
  const r = Router();

  r.get('/', async (_req, res) => {
    res.json(await repo.departamentos.listar());
  });

  r.post('/', autenticar, exigirAdmin, validar(criarSetorSchema), async (req, res) => {
    const setor = await repo.departamentos.criar(req.body);
    await auditar(repo, req, 'criou', 'setor', setor.code);
    res.status(201).json(setor);
  });

  r.put('/:id', autenticar, exigirAdmin, validar(atualizarSetorSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const setor = await repo.departamentos.atualizar(id, req.body);
    await auditar(repo, req, 'editou', 'setor', setor.code);
    res.json(setor);
  });

  r.delete('/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    await repo.departamentos.remover(id);
    await auditar(repo, req, 'excluiu', 'setor', `id ${id}`);
    res.json({ ok: true });
  });

  // Move/mescla: manda todas as pessoas deste setor para outro; opcionalmente
  // exclui o setor de origem (já esvaziado) no fim.
  r.post('/:id/mover', autenticar, exigirAdmin, validar(moverPessoasSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const origem = await repo.departamentos.listar().then((ds) => ds.find((d) => d.id === id));
    if (!origem) {
      res.status(404).json({ erro: 'setor de origem não encontrado' });
      return;
    }
    const { destino, excluirOrigem } = req.body as { destino: string; excluirOrigem: boolean };
    if (destino === origem.code) {
      res.status(422).json({ erro: 'o destino deve ser diferente da origem' });
      return;
    }
    const movidas = await repo.departamentos.moverPessoas(origem.code, destino);
    let excluido = false;
    if (excluirOrigem) {
      await repo.departamentos.remover(id); // já está vazio -> não bloqueia
      excluido = true;
    }
    await auditar(
      repo,
      req,
      excluido ? 'mesclou' : 'moveu pessoas de',
      'setor',
      `${origem.code} -> ${destino} (${movidas})`,
    );
    res.json({ movidas, destino, excluido });
  });

  return r;
}
