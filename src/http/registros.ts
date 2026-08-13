import { Router } from 'express';
import { type AuthedRequest, autenticar, exigirGestao } from '../auth';
import type { Repositorio } from '../data/repositorio';
import type { Recurso } from '../domain/recurso';
import { schemaDeRegistro } from '../domain/recurso';
import { auditar, idParam } from './util';

// REGISTROS dos recursos dirigidos por dados: /api/r/<chave>.
//
// O schema de validação não está escrito aqui — é MONTADO a partir da definição
// que o admin criou pela tela (schemaDeRegistro). Por isso a validação continua
// tão rigorosa quanto a dos recursos escritos à mão, sem precisar de código
// novo por recurso.
//
// Escrita exige gestão (admin ou gestor). O escopo por setor do gestor não se
// aplica: estes recursos são listas gerais, sem dono por setor.
export function montarRegistros(repo: Repositorio): Router {
  // Sem mergeParams: ":chave" é declarado neste próprio router.
  const r = Router();

  // O Express 5 tipa params como string | string[]; aqui é sempre um segmento.
  const chaveDe = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));

  // Resolve a definição antes de qualquer coisa: sem ela não há o que validar.
  async function exigirRecurso(chave: string, res: Parameters<typeof idParam>[1]): Promise<Recurso | null> {
    const recurso = await repo.recursos.porChave(chave);
    if (!recurso) {
      res.status(404).json({ erro: `recurso "${chave}" não existe` });
      return null;
    }
    return recurso;
  }

  // Valida o corpo contra o schema gerado; devolve os valores prontos ou null
  // (já tendo respondido 422 no formato usado pelo resto da API).
  function validarValores(
    recurso: Recurso,
    corpo: unknown,
    res: Parameters<typeof idParam>[1],
  ): Record<string, unknown> | null {
    const resultado = schemaDeRegistro(recurso).safeParse(corpo ?? {});
    if (!resultado.success) {
      res.status(422).json({ erro: 'validação falhou', detalhes: resultado.error.issues });
      return null;
    }
    return resultado.data;
  }

  r.get('/:chave', async (req, res) => {
    const recurso = await exigirRecurso(chaveDe(req.params.chave), res);
    if (!recurso) return;
    const busca = typeof req.query.busca === 'string' ? req.query.busca : undefined;
    res.json({ recurso, registros: await repo.registros.listar(recurso.chave, busca) });
  });

  r.post('/:chave', autenticar, exigirGestao, async (req: AuthedRequest, res) => {
    const recurso = await exigirRecurso(chaveDe(req.params.chave), res);
    if (!recurso) return;
    const valores = validarValores(recurso, req.body, res);
    if (!valores) return;
    const registro = await repo.registros.criar(recurso.chave, valores);
    await auditar(repo, req, 'criou', recurso.nome, rotulo(recurso, valores));
    res.status(201).json(registro);
  });

  r.put('/:chave/:id', autenticar, exigirGestao, async (req: AuthedRequest, res) => {
    const recurso = await exigirRecurso(chaveDe(req.params.chave), res);
    if (!recurso) return;
    const id = idParam(req, res);
    if (id === null) return;
    const atual = await repo.registros.obter(id);
    if (!atual || atual.recurso !== recurso.chave) {
      res.status(404).json({ erro: 'registro não encontrado' });
      return;
    }
    const valores = validarValores(recurso, req.body, res);
    if (!valores) return;
    const registro = await repo.registros.atualizar(id, valores);
    await auditar(repo, req, 'editou', recurso.nome, rotulo(recurso, valores));
    res.json(registro);
  });

  r.delete('/:chave/:id', autenticar, exigirGestao, async (req: AuthedRequest, res) => {
    const recurso = await exigirRecurso(chaveDe(req.params.chave), res);
    if (!recurso) return;
    const id = idParam(req, res);
    if (id === null) return;
    const atual = await repo.registros.obter(id);
    if (!atual || atual.recurso !== recurso.chave) {
      res.status(404).json({ erro: 'registro não encontrado' });
      return;
    }
    const registro = await repo.registros.remover(id);
    await auditar(repo, req, 'excluiu', recurso.nome, rotulo(recurso, registro.valores));
    res.json(registro);
  });

  return r;
}

// Como o registro aparece na auditoria: o primeiro campo de texto é o que mais
// se parece com um nome ("Garrafão de água"), então serve de rótulo.
function rotulo(recurso: Recurso, valores: Record<string, unknown>): string {
  const campo = recurso.campos.find((c) => c.tipo === 'texto') ?? recurso.campos[0];
  const v = campo ? valores[campo.chave] : null;
  return v == null || v === '' ? `${recurso.nome} (sem rótulo)` : String(v);
}
