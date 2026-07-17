// Trilha de auditoria: quem fez o quê, quando — importante a partir do momento
// em que há várias contas de gestão. Registrada nas rotas de escrita; leitura
// só para administradores. O repositório guarda os últimos N registros.

export interface RegistroAuditoria {
  id: number;
  quando: string; // ISO
  quemId: number | null;
  quem: string; // nome (denormalizado — sobrevive à exclusão da conta)
  acao: string; // 'criou' | 'editou' | 'excluiu' | 'entrou' | 'trocou a senha'…
  alvo: string; // 'pessoa' | 'comunicado' | 'setor' | 'conta' | 'tile'…
  detalhe: string; // ex.: nome da pessoa / título do comunicado
}

export const AUDITORIA_MAXIMO = 2000;
