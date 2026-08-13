import type { Perfil } from '../perfil';

// Perfil da INTRANET DA SEPLAG — o projeto que originou este chassi.
// Trocar de perfil (ver src/perfil.ts) troca identidade e conteúdo inicial.

export const seplag: Perfil = {
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
