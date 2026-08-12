import type { DadosNovoTile } from './domain/tile';

// ===========================================================================
// PERFIL DO PROJETO — o único arquivo a editar para nascer uma intranet nova.
//
// Reúne o que é do ASSUNTO (identidade visual e conteúdo inicial); o resto do
// código não conhece "SEPLAG". Para outro projeto (uma intranet residencial,
// por exemplo), troque os valores abaixo e nada mais precisa ser caçado no
// meio do código.
//
// Os blocos de conteúdo (departamentos, navegação, tiles) só são aplicados na
// PRIMEIRA execução, quando o banco está vazio — depois disso quem manda é o
// que o admin editou pela tela.
// ===========================================================================

export interface DepartamentoSeed {
  code: string;
  name: string;
  description: string;
}

export interface GrupoNavegacaoSeed {
  nome: string;
  url?: string;
  destaque?: boolean;
  itens: { label: string; url: string; descricao?: string }[];
}

export interface Perfil {
  /** Nome do produto, na barra lateral e no login (ex.: "Intranet"). */
  nome: string;
  /** A quem pertence — linha de baixo da marca (ex.: "SEPLAG", "Família Silva"). */
  organizacao: string;
  /** Iniciais do quadrinho da marca quando não há logo (2–3 letras). */
  marca: string;
  /** Caminho de uma imagem em `public/` (ex.: "/logo.svg"). Definido, substitui as iniciais. */
  logo: string | null;

  // ---- conteúdo inicial (só na primeira execução) ----
  departamentos: DepartamentoSeed[];
  navegacao: GrupoNavegacaoSeed[];
  tiles: DadosNovoTile[];
}

export const perfil: Perfil = {
  nome: 'Intranet',
  organizacao: 'SEPLAG',
  marca: 'SP',
  logo: null,

  // Estrutura organizacional (não é dado pessoal — pode ser versionada).
  departamentos: [
    { code: 'SECOGE', name: 'SECOGE - Secretaria de Controladoria Geral do Estado', description: 'Controladoria Geral' },
    { code: 'SEPO', name: 'SEPO - Secretaria Executiva de Planejamento e Orçamento', description: 'Planejamento e Orçamento' },
    { code: 'IGPE', name: 'IGPE - Instituto de Gestão Pública de Pernambuco', description: 'Gestão Pública' },
    { code: 'GABINETE', name: 'GABINETE', description: 'Gabinete do Secretário' },
    { code: 'SEDRC', name: 'SEDRC - Sec. Exec. de Desenv. Regional e Captação', description: 'Desenvolvimento Regional' },
    { code: 'SEGPR', name: 'SEGPR - Sec. Exec. de Gestão para Resultados', description: 'Gestão para Resultados' },
    { code: 'SEGES', name: 'SEGES - Secretaria Executiva de Gestão Estratégica', description: 'Gestão Estratégica' },
    { code: 'CEDIDA', name: 'CEDIDA', description: 'Servidores cedidos a outros órgãos' },
    { code: 'OUTROS', name: 'OUTROS', description: 'Outros Setores' },
  ],

  // Navegação inicial de EXEMPLO, espelhando o Seplagnet. O admin ajusta as
  // URLs reais e adiciona/remove itens pela própria tela (é dado, não código).
  navegacao: [
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
  ],

  // Tiles iniciais do dashboard (o admin edita rótulo/URL/ícone/cor pela tela;
  // as URLs abaixo são PONTO DE PARTIDA — confirme os endereços reais).
  tiles: [
    { label: 'Ponto', icon: 'badge', cor: '#1e73be', url: 'https://www.seplag.pe.gov.br' },
    { label: 'Contracheque', icon: 'request_quote', cor: '#1f8a52', url: 'https://www.seplag.pe.gov.br' },
    { label: 'SEI!', icon: 'description', cor: '#c46a12', url: 'https://sei.pe.gov.br' },
    { label: 'Suporte', icon: 'support_agent', cor: '#6b3fd1', url: 'https://www.seplag.pe.gov.br' },
    { label: 'Manuais', icon: 'menu_book', cor: '#b23c6e', url: 'https://www.seplag.pe.gov.br' },
    { label: 'Ramais', icon: 'groups', cor: '#0f7a86', url: '#ramais' },
  ],
};

/** Título da aba do navegador — derivado, para não repetir o nome em dois lugares. */
export function tituloDoPerfil(p: Perfil = perfil): string {
  return p.organizacao ? `${p.nome} ${p.organizacao}` : p.nome;
}

/** O que a interface precisa saber (sem o conteúdo de seed). */
export function identidade(p: Perfil = perfil): {
  nome: string;
  organizacao: string;
  marca: string;
  logo: string | null;
  titulo: string;
} {
  return {
    nome: p.nome,
    organizacao: p.organizacao,
    marca: p.marca,
    logo: p.logo,
    titulo: tituloDoPerfil(p),
  };
}
