import { Router } from 'express';
import { type AuthedRequest, autenticar, exigirGestao, gerenciaSetor } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { atualizarPessoaSchema, criarPessoaSchema } from '../domain/pessoa';
import { auditar, idParam, validar } from './util';

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

  // Escrita: admin (tudo) ou gestor (somente pessoas dos SEUS setores).
  const foraDoEscopo = { erro: 'fora dos seus setores — peça a um administrador' };

  r.post('/', autenticar, exigirGestao, validar(criarPessoaSchema), async (req: AuthedRequest, res) => {
    if (!gerenciaSetor(req.user, req.body.departmentCode)) {
      res.status(403).json(foraDoEscopo);
      return;
    }
    const p = await repo.pessoas.criar(req.body);
    await auditar(repo, req, 'cadastrou', 'pessoa', p.name);
    res.status(201).json(p);
  });

  r.put('/:id', autenticar, exigirGestao, validar(atualizarPessoaSchema), async (req: AuthedRequest, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const atual = await repo.pessoas.obter(id);
    if (!atual) {
      res.status(404).json({ erro: 'pessoa não encontrada' });
      return;
    }
    // Gestor: a pessoa precisa estar num setor dele E continuar num setor dele.
    const destino = 'departmentCode' in req.body ? req.body.departmentCode : atual.departmentCode;
    if (!gerenciaSetor(req.user, atual.departmentCode) || !gerenciaSetor(req.user, destino)) {
      res.status(403).json(foraDoEscopo);
      return;
    }
    const p = await repo.pessoas.atualizar(id, req.body);
    await auditar(repo, req, 'editou', 'pessoa', p.name);
    res.json(p);
  });

  r.delete('/:id', autenticar, exigirGestao, async (req: AuthedRequest, res) => {
    const id = idParam(req, res);
    if (id === null) return;
    const atual = await repo.pessoas.obter(id);
    if (!atual) {
      res.status(404).json({ erro: 'pessoa não encontrada' });
      return;
    }
    if (!gerenciaSetor(req.user, atual.departmentCode)) {
      res.status(403).json(foraDoEscopo);
      return;
    }
    const p = await repo.pessoas.remover(id);
    await auditar(repo, req, 'excluiu', 'pessoa', p.name);
    res.json(p);
  });

  return r;
}
