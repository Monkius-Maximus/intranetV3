import type { Perfil } from '../perfil';

// Perfil CASA — intranet residencial. Mostra o chassi servindo um assunto
// completamente diferente do original: em vez de secretarias e ramais, as
// perguntas do dia a dia de uma casa.
//
// As três páginas abaixo são recursos DIRIGIDOS POR DADOS: nascem prontas com
// o sistema, mas depois são editáveis pela própria tela ("Páginas"), como
// qualquer lista criada pelo morador.

export const casa: Perfil = {
  nome: 'Intranet',
  organizacao: 'Casa',
  marca: 'CS',
  logo: null,

  // "Setores" aqui são as áreas da casa — usadas para situar moradores e
  // responsáveis. O admin renomeia/cria pela tela.
  departamentos: [
    { code: 'COZINHA', name: 'Cozinha', description: 'Alimentos e utensílios' },
    { code: 'DESPENSA', name: 'Despensa', description: 'Estoque seco e bebidas' },
    { code: 'LIMPEZA', name: 'Limpeza', description: 'Produtos e materiais' },
    { code: 'GARAGEM', name: 'Garagem', description: 'Ferramentas e manutenção' },
    { code: 'GERAL', name: 'Geral', description: 'Assuntos da casa toda' },
  ],

  navegacao: [
    {
      nome: 'Contas',
      itens: [
        { label: 'Energia', url: 'https://exemplo.local/energia', descricao: 'Segunda via e consumo' },
        { label: 'Água', url: 'https://exemplo.local/agua', descricao: 'Segunda via e consumo' },
        { label: 'Internet', url: 'https://exemplo.local/internet', descricao: 'Fatura e suporte' },
      ],
    },
    {
      nome: 'Acesso rápido',
      destaque: true,
      itens: [
        { label: 'O que está faltando', url: '#r:estoque', descricao: 'Estoque abaixo do mínimo' },
        { label: 'Gastos do mês', url: '#r:lancamentos', descricao: 'O que já saiu' },
      ],
    },
  ],

  tiles: [
    { label: 'Estoque', icon: 'folder_open', cor: '#0f7a86', url: '#r:estoque' },
    { label: 'Gastos', icon: 'savings', cor: '#1f8a52', url: '#r:lancamentos' },
    { label: 'Tarefas', icon: 'assignment', cor: '#c46a12', url: '#r:tarefas' },
    { label: 'Moradores', icon: 'groups', cor: '#1e73be', url: '#ramais' },
    { label: 'Agenda', icon: 'calendar_month', cor: '#6b3fd1', url: '#inicio' },
  ],

  // ------------------------------------------------------------------------
  // As perguntas da casa viram páginas:
  //   "quanto gastamos por mês?"          -> Lançamentos
  //   "quantos garrafões ainda temos?"    -> Estoque
  //   "quando comprar o material X?"      -> Estoque (quantidade x mínimo)
  //   "o que precisamos cumprir?"         -> Tarefas
  // ------------------------------------------------------------------------
  recursos: [
    {
      chave: 'estoque',
      nome: 'Estoque',
      icone: 'folder_open',
      campos: [
        { chave: 'item', rotulo: 'Item', tipo: 'texto', obrigatorio: true },
        { chave: 'quantidade', rotulo: 'Quantidade', tipo: 'numero', obrigatorio: true },
        { chave: 'minimo', rotulo: 'Mínimo', tipo: 'numero' },
        { chave: 'unidade', rotulo: 'Unidade', tipo: 'selecao', opcoes: ['un', 'L', 'kg', 'pacote', 'caixa'] },
        { chave: 'onde', rotulo: 'Onde fica', tipo: 'texto' },
      ],
    },
    {
      chave: 'lancamentos',
      nome: 'Gastos',
      icone: 'savings',
      campos: [
        { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true },
        { chave: 'valor', rotulo: 'Valor (R$)', tipo: 'numero', obrigatorio: true },
        { chave: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
        {
          chave: 'categoria',
          rotulo: 'Categoria',
          tipo: 'selecao',
          opcoes: ['Mercado', 'Contas', 'Casa', 'Saúde', 'Transporte', 'Lazer', 'Outros'],
        },
        { chave: 'quem', rotulo: 'Quem pagou', tipo: 'texto' },
        { chave: 'pago', rotulo: 'Já pago', tipo: 'booleano' },
      ],
    },
    {
      chave: 'tarefas',
      nome: 'Tarefas',
      icone: 'assignment',
      campos: [
        { chave: 'tarefa', rotulo: 'Tarefa', tipo: 'texto', obrigatorio: true },
        { chave: 'responsavel', rotulo: 'Responsável', tipo: 'texto' },
        { chave: 'prazo', rotulo: 'Prazo', tipo: 'data' },
        { chave: 'recorrencia', rotulo: 'Repete', tipo: 'selecao', opcoes: ['Uma vez', 'Semanal', 'Mensal', 'Anual'] },
        { chave: 'feita', rotulo: 'Concluída', tipo: 'booleano' },
      ],
    },
  ],
};
