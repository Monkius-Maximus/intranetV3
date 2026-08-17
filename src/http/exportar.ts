import { Router } from 'express';
import { type AuthedRequest, autenticar } from '../auth';
import type { Repositorio } from '../data/repositorio';
import { CONJUNTOS, conjuntoPorNome } from '../exportar/conjuntos';
import { gerarCsv, separadorDe } from '../exportar/csv';
import { auditar } from './util';

// Extração da base em CSV — a conferência da intranet feita fora dela, numa
// planilha. Um conjunto por arquivo (ver src/exportar/conjuntos.ts).

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function montarExportar(repo: Repositorio): Router {
  const r = Router();

  // Tudo aqui exige login: é despejo da base inteira, mesmo que o diretório
  // seja de leitura pública item a item.
  r.use(autenticar);

  // Catálogo do que dá para extrair, já filtrado pelo papel de quem pergunta —
  // a tela monta os botões a partir daqui, sem repetir a lista no front.
  r.get('/', (req: AuthedRequest, res) => {
    const admin = req.user?.role === 'admin';
    res.json(
      CONJUNTOS.filter((c) => admin || !c.admin).map((c) => ({
        nome: c.nome,
        titulo: c.titulo,
        descricao: c.descricao,
        admin: c.admin,
        colunas: c.colunas,
      })),
    );
  });

  // `/pessoas.csv` chega como o parâmetro "pessoas.csv" — tirar o sufixo aqui
  // evita depender de como a versão do roteador trata o ponto no padrão.
  r.get('/:nome', async (req: AuthedRequest, res) => {
    const nome = String(req.params.nome).replace(/\.csv$/i, '');
    const conjunto = conjuntoPorNome(nome);
    if (!conjunto) {
      res.status(404).json({ erro: `conjunto desconhecido: ${nome}`, disponiveis: CONJUNTOS.map((c) => c.nome) });
      return;
    }
    if (conjunto.admin && req.user?.role !== 'admin') {
      res.status(403).json({ erro: 'acesso restrito a administradores' });
      return;
    }

    const busca = typeof req.query.busca === 'string' ? req.query.busca : undefined;
    const setor = typeof req.query.setor === 'string' ? req.query.setor : undefined;
    const linhas = await conjunto.linhas(repo, { busca, setor });
    const csv = gerarCsv(conjunto.colunas, linhas, separadorDe(req.query.sep));

    // A própria extração entra na trilha: uma cópia da base saiu daqui, e a
    // auditoria deve saber quem a levou.
    const quantas = `${linhas.length} linha${linhas.length === 1 ? '' : 's'}`;
    await auditar(repo, req, 'exportou', 'base', `${conjunto.titulo} (${quantas})`);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${conjunto.nome}-${hoje()}.csv"`);
    res.send(csv);
  });

  return r;
}
