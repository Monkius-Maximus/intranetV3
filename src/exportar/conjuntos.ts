import type { FiltroPessoa, Repositorio } from '../data/repositorio';
import type { Celula } from './csv';

// Catálogo do que dá para extrair da base em CSV — uma planilha por conjunto,
// para conferência fora da aplicação (Excel, LibreOffice, Sheets).
//
// Cada conjunto é um dado, não uma rota: acrescentar um aqui já o faz aparecer
// no catálogo da API, nos botões da tela de Auditoria e no download. As linhas
// saem do repositório (o contrato), então isto continua valendo se a
// persistência deixar de ser um arquivo JSON.

export interface Conjunto {
  nome: string; // usado na URL: /api/exportar/<nome>.csv
  titulo: string;
  descricao: string;
  admin: boolean; // true = só administradores (contas, trilha de auditoria)
  colunas: string[];
  linhas(repo: Repositorio, filtro: FiltroPessoa): Promise<Celula[][]>;
}

const sim = (b: boolean): string => (b ? 'sim' : 'não');

export const CONJUNTOS: Conjunto[] = [
  {
    nome: 'pessoas',
    titulo: 'Pessoas e ramais',
    descricao: 'Quadro de servidores: setores, cargo, ramal, e-mail e aniversário',
    admin: false,
    colunas: [
      'ID',
      'Nome',
      'Setor principal',
      'Todos os setores',
      'Setor completo',
      'Cargo',
      'Ramal',
      'E-mail',
      'Dia nasc.',
      'Mês nasc.',
      'Status',
      'Competências',
      'Atuação início',
      'Atuação fim',
      'Origem do dado',
    ],
    // Respeita busca/setor: a extração sai igual à vista filtrada na tela.
    linhas: async (repo, filtro) =>
      (await repo.pessoas.listar(filtro)).map((p) => [
        p.id,
        p.name,
        p.departmentCode,
        (p.setores ?? []).join(', '),
        p.departmentFull,
        p.cargo,
        p.phoneExtension,
        p.email,
        p.birthDay,
        p.birthMonth,
        (p.status || 'ativo') === 'ex' ? 'inativo' : 'ativo',
        (p.competencias ?? []).join(', '),
        p.atuacao?.inicio ?? null,
        p.atuacao?.fim ?? null,
        p.fonte,
      ]),
  },
  {
    nome: 'setores',
    titulo: 'Setores',
    descricao: 'Siglas, nomes, secretaria-mãe e quantas pessoas há em cada um',
    admin: false,
    colunas: ['ID', 'Sigla', 'Nome', 'Descrição', 'Setor-mãe', 'Pessoas'],
    linhas: async (repo) => {
      const [setores, pessoas] = await Promise.all([repo.departamentos.listar(), repo.pessoas.todas()]);
      // Conta pela lista de setores da pessoa: quem está em SECOGE e no núcleo
      // NSI conta nos dois — é assim que o filtro da tela também enxerga.
      const quantos = new Map<string, number>();
      for (const p of pessoas) {
        for (const s of new Set(p.setores?.length ? p.setores : [p.departmentCode])) {
          if (s) quantos.set(s, (quantos.get(s) ?? 0) + 1);
        }
      }
      return setores.map((d) => [d.id, d.code, d.name, d.description ?? '', d.parent ?? '', quantos.get(d.code) ?? 0]);
    },
  },
  {
    nome: 'contas',
    titulo: 'Contas de acesso',
    descricao: 'Quem tem login, com que papel e sobre quais setores (nunca senhas)',
    admin: true,
    colunas: ['ID', 'Nome', 'E-mail', 'Papel', 'Setores geridos', 'Ativa', 'Troca de senha pendente'],
    // O hash da senha NÃO sai daqui — nem em uma extração de auditoria.
    linhas: async (repo) =>
      (await repo.usuarios.listar()).map((u) => [
        u.id,
        u.name,
        u.email,
        u.role,
        (u.setores ?? []).join(', '),
        sim(u.ativo !== false),
        sim(u.mustChangePassword === true),
      ]),
  },
  {
    nome: 'auditoria',
    titulo: 'Trilha de auditoria',
    descricao: 'Quem fez o quê e quando — as ações registradas pelo sistema',
    admin: true,
    colunas: ['ID', 'Quando (ISO)', 'ID de quem', 'Quem', 'Ação', 'Alvo', 'Detalhe'],
    linhas: async (repo) =>
      (await repo.auditoria.listar(Number.MAX_SAFE_INTEGER)).map((a) => [
        a.id,
        a.quando,
        a.quemId,
        a.quem,
        a.acao,
        a.alvo,
        a.detalhe,
      ]),
  },
  {
    nome: 'avisos',
    titulo: 'Comunicados',
    descricao: 'Comunicados publicados, com categoria, autor e anexos',
    admin: false,
    colunas: ['ID', 'Título', 'Categoria', 'Fixado', 'Autor', 'Criado em (ISO)', 'Anexos', 'Texto'],
    linhas: async (repo) =>
      (await repo.avisos.listar()).map((a) => [
        a.id,
        a.title,
        a.categoria,
        sim(a.pinned),
        a.autor,
        a.createdAt,
        (a.anexos ?? []).map((x) => x.nome).join(', '),
        a.body,
      ]),
  },
  {
    nome: 'eventos',
    titulo: 'Agenda',
    descricao: 'Eventos cadastrados na agenda',
    admin: false,
    colunas: ['ID', 'Título', 'Data', 'Hora', 'Local'],
    linhas: async (repo) => (await repo.eventos.listar()).map((e) => [e.id, e.titulo, e.data, e.hora, e.local]),
  },
  {
    nome: 'links',
    titulo: 'Links e menus',
    descricao: 'A navegação do portal, achatada em uma linha por link',
    admin: false,
    colunas: ['Grupo', 'Ordem do grupo', 'Destaque', 'URL do grupo', 'Link', 'URL do link', 'Descrição', 'Ordem do link'],
    // Achata a árvore: grupos sem itens continuam aparecendo (uma linha só).
    linhas: async (repo) =>
      (await repo.navegacao.arvore()).flatMap((g) =>
        g.itens.length === 0
          ? [[g.nome, g.ordem, sim(g.destaque), g.url, '', '', '', ''] as Celula[]]
          : g.itens.map(
              (i) => [g.nome, g.ordem, sim(g.destaque), g.url, i.label, i.url, i.descricao, i.ordem] as Celula[],
            ),
      ),
  },
];

export function conjuntoPorNome(nome: string): Conjunto | undefined {
  return CONJUNTOS.find((c) => c.nome === nome);
}
