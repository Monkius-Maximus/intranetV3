// Importa o quadro de funcionários a partir do XLSX de ANIVERSARIANTES
// exportado do Seplagnet atual (rota "aniversariantes2").
//
// Formato esperado (uma planilha):
//   - linhas-cabeçalho "Aniversariantes do mês de <Mês>" separando os grupos
//   - linhas de dados com 3 colunas: dia | nome | setor (ex.: "SEDRC/GGCR")
//
// E-mail e ramal não existem nessa fonte: ficam vazios, para preencher depois
// pela tela do admin (ou por uma integração futura, ex.: Synergy+).
//
// Uso:
//   npm run importar-aniversariantes -- /caminho/ANIVERSARIANTES_SEPLAG_2026.xlsx
//
import { existsSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { seed } from '../src/seed';
import * as store from '../src/store';

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

// Grafias divergentes vistas no dado real -> código de setor canônico.
const APELIDOS: Record<string, string> = {
  CEDIDO: 'CEDIDA',
  GABINTE: 'GABINETE',
  SUGESPE: 'SECOGE', // SUGESPE é subunidade da SECOGE
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

interface Linha {
  dia: number;
  mes: number;
  nome: string;
  setor: string | null;
}

async function lerPlanilha(arquivo: string): Promise<{ linhas: Linha[]; ignoradas: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('planilha vazia (nenhuma aba encontrada)');

  const linhas: Linha[] = [];
  const ignoradas: string[] = [];
  let mesAtual: number | null = null;

  for (let r = 1; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).values as ExcelJS.CellValue[];
    const a = celulaTexto(v[1]);
    const b = celulaTexto(v[2]);
    const c = celulaTexto(v[3]);
    if (!a && !b && !c) continue;

    // Linha-cabeçalho de mês: só a 1ª coluna preenchida.
    if (!b && !c) {
      const m = /m[eê]s de\s+(\S+)/i.exec(a);
      const numero = m ? MESES[m[1].toLowerCase()] : undefined;
      if (numero) {
        mesAtual = numero;
      } else {
        ignoradas.push(`linha ${r}: cabeçalho não reconhecido ("${a}")`);
      }
      continue;
    }

    const dia = Number(a);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31 || !b) {
      ignoradas.push(`linha ${r}: dados inválidos (dia="${a}", nome="${b}")`);
      continue;
    }
    if (mesAtual === null) {
      ignoradas.push(`linha ${r}: dados antes do primeiro cabeçalho de mês`);
      continue;
    }
    linhas.push({ dia, mes: mesAtual, nome: b, setor: c || null });
  }
  return { linhas, ignoradas };
}

async function main(): Promise<void> {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('Uso: npm run importar-aniversariantes -- <arquivo.xlsx>');
    process.exit(1);
  }
  if (!existsSync(arquivo)) {
    console.error(`Arquivo não encontrado: ${arquivo}`);
    console.error('Confira o caminho (no Windows, use aspas se houver espaços).');
    process.exit(1);
  }

  const { linhas, ignoradas } = await lerPlanilha(arquivo);
  if (linhas.length === 0) {
    console.error(`Nenhum registro reconhecido em ${arquivo}.`);
    console.error('Formato esperado: cabeçalhos "Aniversariantes do mês de <Mês>" + linhas dia|nome|setor.');
    process.exit(1);
  }

  await store.iniciar();
  await seed(); // garante departamentos/admin antes de vincular

  const semCodigo = new Map<string, number>();
  const registros = linhas.map((l) => {
    // "SECOGE\GGADM" -> "SECOGE/GGADM"; prefixo antes da barra é o código.
    const setorLimpo = l.setor?.replace(/\\/g, '/') ?? null;
    const prefixo = setorLimpo?.split('/')[0].trim().toUpperCase() ?? null;
    const codigo = prefixo ? (APELIDOS[prefixo] ?? prefixo) : null;
    const valido = codigo !== null && store.getDepartmentByCode(codigo) !== undefined;
    if (prefixo && !valido) {
      semCodigo.set(prefixo, (semCodigo.get(prefixo) ?? 0) + 1);
    }
    return {
      name: l.nome,
      email: null,
      phoneExtension: null,
      departmentCode: valido ? codigo : null,
      departmentFull: setorLimpo,
      birthDay: l.dia,
      birthMonth: l.mes,
    };
  });

  const total = await store.replaceEmployees(registros);
  console.log(`Importados ${total} funcionários (fonte: aniversariantes).`);
  console.log('E-mail e ramal ficaram vazios — preencha pela tela do admin quando tiver os dados.');
  if (semCodigo.size > 0) {
    const resumo = [...semCodigo].map(([p, n]) => `${p} (${n})`).join(', ');
    console.warn(`Aviso: setores sem código conhecido, mantidos só como texto: ${resumo}`);
  }
  if (ignoradas.length > 0) {
    console.warn(`Aviso: ${ignoradas.length} linha(s) ignorada(s):`);
    for (const i of ignoradas.slice(0, 10)) console.warn(`  - ${i}`);
  }
}

main();
