import ExcelJS from 'exceljs';
import type { PessoaImportada } from '../domain/pessoa';
import type { ResultadoLeitura } from './contrato';

// Origem: XLSX exportado da rota "aniversariantes2" do Seplagnet atual.
// Formato: cabeçalhos "Aniversariantes do mês de <Mês>" + linhas dia|nome|setor.
// Fornece só o NÚCLEO (nome, setor, dia/mês); e-mail e ramal não existem aqui.

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

// Grafias divergentes vistas no dado real -> código de setor canônico.
const APELIDOS: Record<string, string> = {
  CEDIDO: 'CEDIDA',
  GABINTE: 'GABINETE',
  SUGESPE: 'SECOGE',
};

function celulaTexto(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('').trim();
    if ('text' in v) return String(v.text).trim();
    if ('result' in v) return String(v.result ?? '').trim();
  }
  return String(v).trim();
}

export async function lerXlsxAniversariantes(arquivo: string): Promise<ResultadoLeitura> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('planilha vazia (nenhuma aba encontrada)');

  const registros: PessoaImportada[] = [];
  const avisos: string[] = [];
  let mesAtual: number | null = null;

  for (let r = 1; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).values as ExcelJS.CellValue[];
    const a = celulaTexto(v[1]);
    const b = celulaTexto(v[2]);
    const c = celulaTexto(v[3]);
    if (!a && !b && !c) continue;

    if (!b && !c) {
      const m = /m[eê]s de\s+(\S+)/i.exec(a);
      const numero = m ? MESES[m[1].toLowerCase()] : undefined;
      if (numero) mesAtual = numero;
      else avisos.push(`linha ${r}: cabeçalho não reconhecido ("${a}")`);
      continue;
    }

    const dia = Number(a);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31 || !b) {
      avisos.push(`linha ${r}: dados inválidos (dia="${a}", nome="${b}")`);
      continue;
    }
    if (mesAtual === null) {
      avisos.push(`linha ${r}: dados antes do primeiro cabeçalho de mês`);
      continue;
    }

    const setorLimpo = c ? c.replace(/\\/g, '/') : null;
    const prefixo = setorLimpo ? setorLimpo.split('/')[0].trim().toUpperCase() : null;
    const codigo = prefixo ? (APELIDOS[prefixo] ?? prefixo) : null;

    registros.push({
      name: b,
      departmentCode: codigo,
      departmentFull: setorLimpo,
      birthDay: dia,
      birthMonth: mesAtual,
    });
  }

  return { registros, avisos };
}
