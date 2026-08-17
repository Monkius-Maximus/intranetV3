// Serializa uma tabela em CSV que o Excel abre limpo. Três detalhes separam o
// "abre bonito" do "abre embaralhado", e todos os três já morderam alguém:
//
//   BOM UTF-8  sem ele o Excel no Windows lê o arquivo como ANSI e os acentos
//              viram mojibake ("José" -> "JosÃ©").
//   separador  o Excel em português espera ';'. Com ',' a planilha inteira cai
//              numa coluna só. Configurável para quem precisa de vírgula.
//   CRLF       fim de linha do RFC 4180 — o que o Excel (e o Sheets) esperam.

export const BOM = '\ufeff';

export type Celula = string | number | boolean | null | undefined;

// O Excel avalia como FÓRMULA todo texto que começa com = + - @ (ou tab/CR).
// Num despejo de campos digitados por usuários isso é injeção de fórmula: um
// nome cadastrado como `=HYPERLINK(...)` viraria código ao abrir a planilha.
// Prefixar com aspa simples faz o Excel EXIBIR o texto sem executá-lo.
const PERIGOSO = /^[=+\-@\t\r]/;

function celula(v: Celula, sep: string): string {
  if (v === null || v === undefined) return '';
  // Números escapam da guarda: um negativo é dado, não fórmula.
  let s = String(v);
  if (typeof v !== 'number' && PERIGOSO.test(s)) s = `'${s}`;
  return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function gerarCsv(colunas: string[], linhas: Celula[][], sep = ';'): string {
  const linha = (vals: Celula[]): string => vals.map((v) => celula(v, sep)).join(sep);
  return `${BOM + [colunas, ...linhas].map(linha).join('\r\n')}\r\n`;
}

// Separador pedido na querystring (?sep=, ou ?sep=tab); o padrão é o do Excel
// em português.
export function separadorDe(valor: unknown): string {
  if (valor === ',' || valor === 'virgula') return ',';
  if (valor === 'tab' || valor === '\t') return '\t';
  return ';';
}
