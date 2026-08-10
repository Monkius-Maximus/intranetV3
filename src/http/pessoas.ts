import { Router } from 'express';
import { type AuthedRequest, autenticar, exigirGestao, gerenciaAlgumSetor } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { atualizarPessoaSchema, criarPessoaSchema } from '../domain/pessoa';
import { gerarXlsxPessoas } from '../exportar/pessoasXlsx';
import { auditar, idParam, validar } from './util';

export function montarPessoas(repo: Repositorio): Router {
  const r = Router();

  // Leitura pública (o usuário comum consulta sem login).
  r.get('/', async (req, res) => {
    const busca = typeof req.query.busca === 'string' ? req.query.busca : undefined;
    const setor = typeof req.query.setor === 'string' ? req.query.setor : undefined;
    res.json(await repo.pessoas.listar({ busca, setor }));
  });

  // Exporta o diretório em .xlsx (respeita busca/setor da querystring, então a
  // planilha sai igual à vista filtrada). Exige login: é um despejo de dados
  // pessoais, mesmo que a listagem individual seja pública.
  r.get('/export.xlsx', autenticar, async (req, res) => {
    const busca = typeof req.query.busca === 'string' ? req.query.busca : undefined;
    const setor = typeof req.query.setor === 'string' ? req.query.setor : undefined;
    const pessoas = await repo.pessoas.listar({ busca, setor });
    const xlsx = await gerarXlsxPessoas(pessoas);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="servidores-seplag.xlsx"');
    res.send(xlsx);
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
    const alvo = [req.body.departmentCode, ...(req.body.setores ?? [])];
    if (!gerenciaAlgumSetor(req.user, alvo)) {
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
    // Gestor: precisa administrar algum setor ATUAL da pessoa E algum setor de
    // DESTINO (impede tirar/pôr alguém para fora do seu escopo).
    const setoresAtuais = atual.setores?.length ? atual.setores : [atual.departmentCode];
    const setoresDestino =
      'setores' in req.body && Array.isArray(req.body.setores) && req.body.setores.length > 0
        ? req.body.setores
        : 'departmentCode' in req.body
          ? [req.body.departmentCode]
          : setoresAtuais;
    if (!gerenciaAlgumSetor(req.user, setoresAtuais) || !gerenciaAlgumSetor(req.user, setoresDestino)) {
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
    if (!gerenciaAlgumSetor(req.user, atual.setores?.length ? atual.setores : [atual.departmentCode])) {
      res.status(403).json(foraDoEscopo);
      return;
    }
    const p = await repo.pessoas.remover(id);
    await auditar(repo, req, 'excluiu', 'pessoa', p.name);
    res.json(p);
  });

  return r;
}
