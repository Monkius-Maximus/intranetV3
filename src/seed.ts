import crypto from 'node:crypto';
import { hashPassword } from './auth';
import { config } from './config';
import type { Repositorio } from './data/repositorio';
import type { DadosNovoTile } from './domain/tile';

// Estrutura organizacional (não é dado pessoal — pode ser versionada).
const DEPARTAMENTOS: { code: string; name: string; description: string }[] = [
  { code: 'SECOGE', name: 'SECOGE - Secretaria de Controladoria Geral do Estado', description: 'Controladoria Geral' },
  { code: 'SEPO', name: 'SEPO - Secretaria Executiva de Planejamento e Orçamento', description: 'Planejamento e Orçamento' },
  { code: 'IGPE', name: 'IGPE - Instituto de Gestão Pública de Pernambuco', description: 'Gestão Pública' },
  { code: 'GABINETE', name: 'GABINETE', description: 'Gabinete do Secretário' },
  { code: 'SEDRC', name: 'SEDRC - Sec. Exec. de Desenv. Regional e Captação', description: 'Desenvolvimento Regional' },
  { code: 'SEGPR', name: 'SEGPR - Sec. Exec. de Gestão para Resultados', description: 'Gestão para Resultados' },
  { code: 'SEGES', name: 'SEGES - Secretaria Executiva de Gestão Estratégica', description: 'Gestão Estratégica' },
  { code: 'CEDIDA', name: 'CEDIDA', description: 'Servidores cedidos a outros órgãos' },
  { code: 'OUTROS', name: 'OUTROS', description: 'Outros Setores' },
];

// Navegação inicial de EXEMPLO, espelhando o Seplagnet. O admin ajusta as URLs
// reais e adiciona/remove itens pela própria tela (é dado, não código).
interface GrupoSeed {
  nome: string;
  url?: string;
  destaque?: boolean;
  itens: { label: string; url: string; descricao?: string }[];
}
const NAVEGACAO: GrupoSeed[] = [
  {
    nome: 'Sistemas',
    itens: [
      { label: 'SEI!', url: 'https://sei.pe.gov.br', descricao: 'Protocolo e gestão de processos' },
      { label: 'Expresso', url: 'https://expresso.pe.gov.br', descricao: 'Correio e agenda' },
      { label: 'e-Fisco', url: 'https://efisco.sefaz.pe.gov.br', descricao: 'Sistema fazendário' },
    ],
  },
  {
    nome: 'Servidor',
    itens: [
      { label: 'Contracheque', url: 'https://portal.seplag.pe.gov.br', descricao: 'Contracheque e perícias' },
      { label: 'Sistema de Ponto', url: 'https://ponto.seplag.pe.gov.br', descricao: 'Registro de frequência' },
      { label: 'Moodle - EAD IGPE', url: 'https://ead.igpe.pe.gov.br', descricao: 'Capacitação' },
    ],
  },
  { nome: 'Transparência', url: 'https://www.transparencia.pe.gov.br', itens: [] },
  {
    nome: 'Acesso rápido',
    destaque: true,
    itens: [
      { label: 'Portal do Servidor', url: 'https://portal.seplag.pe.gov.br', descricao: 'Contracheques e informações' },
      { label: 'E-mail (Webmail)', url: 'https://webmail.seplag.pe.gov.br', descricao: 'E-mail corporativo' },
    ],
  },
];

// Tiles iniciais do dashboard (o admin edita rótulo/URL/ícone/cor pela tela;
// as URLs abaixo são PONTO DE PARTIDA — confirme os endereços reais).
const TILES: DadosNovoTile[] = [
  { label: 'Ponto', icon: 'badge', cor: '#1e73be', url: 'https://www.seplag.pe.gov.br' },
  { label: 'Contracheque', icon: 'request_quote', cor: '#1f8a52', url: 'https://www.seplag.pe.gov.br' },
  { label: 'SEI!', icon: 'description', cor: '#c46a12', url: 'https://sei.pe.gov.br' },
  { label: 'Suporte', icon: 'support_agent', cor: '#6b3fd1', url: 'https://www.seplag.pe.gov.br' },
  { label: 'Manuais', icon: 'menu_book', cor: '#b23c6e', url: 'https://www.seplag.pe.gov.br' },
  { label: 'Ramais', icon: 'groups', cor: '#0f7a86', url: '#ramais' },
];

export async function seed(repo: Repositorio): Promise<void> {
  // Só na primeira execução: depois disso os setores são GERIDOS PELO ADMIN
  // (criar/renomear/excluir pela tela) — reaplicar o seed desfaria as edições.
  if ((await repo.departamentos.contar()) === 0) {
    for (const d of DEPARTAMENTOS) {
      await repo.departamentos.upsert(d);
    }
  }

  if ((await repo.tiles.contar()) === 0) {
    for (const t of TILES) {
      await repo.tiles.criar(t);
    }
  }

  if ((await repo.navegacao.contarGrupos()) === 0) {
    for (const g of NAVEGACAO) {
      const grupo = await repo.navegacao.criarGrupo({
        nome: g.nome,
        url: g.url ?? null,
        destaque: Boolean(g.destaque),
      });
      for (const it of g.itens) {
        await repo.navegacao.criarItem({
          grupoId: grupo.id,
          label: it.label,
          url: it.url,
          descricao: it.descricao ?? null,
        });
      }
    }
  }

  if ((await repo.usuarios.contar()) === 0) {
    const senha = config.adminPassword ?? crypto.randomBytes(9).toString('base64url');
    await repo.usuarios.criar({
      email: config.adminEmail,
      passwordHash: hashPassword(senha),
      role: 'admin',
      name: 'Administrador',
    });
    if (!config.adminPassword) {
      console.log('\n=================== ADMIN CRIADO ===================');
      console.log(`  e-mail: ${config.adminEmail}`);
      console.log(`  senha : ${senha}`);
      console.log('  (anote agora — não será exibida novamente)');
      console.log('===================================================\n');
    }
  }
}
