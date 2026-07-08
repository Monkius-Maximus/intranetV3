import { Router } from 'express';
import { autenticar, exigirAdmin } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { atualizarPessoaSchema, criarPessoaSchema } from '../domain/pessoa';
import { idParam, validar } from './util';

export function montarPessoas(repo: Repositorio): Router {
  const r = Router();

  // Leitura pública (o usuário comum consulta sem login).
  r.get('/', async (req, res) => {
    const busca = typeof req.query.busca === 'string' ? req.query.busca : undefined;
    const setor = typeof req.query.setor === 'string' ? req.query.setor : undefined;
    res.json(await repo.pessoas.listar({ busca, setor }));
  });

  r.get('/:id', async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const p = await repo.pessoas.obter(id);
    if (!p) {
      res.status(404).json({ erro: 'pessoa não encontrada' });
      return;
    }
    res.json(p);
  });

  // Escrita: só administrador.
  r.post('/', autenticar, exigirAdmin, validar(criarPessoaSchema), async (req, res) => {
    res.status(201).json(await repo.pessoas.criar(req.body));
  });

  r.put('/:id', autenticar, exigirAdmin, validar(atualizarPessoaSchema), async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    res.json(await repo.pessoas.atualizar(id, req.body));
  });

  r.delete('/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    res.json(await repo.pessoas.remover(id));
  });

  return r;
}
