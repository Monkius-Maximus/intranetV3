import { readFileSync } from 'node:fs';
import type { PessoaImportada } from '../domain/pessoa';
import type { ResultadoLeitura } from './contrato';

// Origem: CSV simples — o plano B universal quando o XLSX do Seplagnet não é
// reconhecido: abra a planilha no Excel e "Salvar como > CSV". Sem dependências.
//
// Formato: 1ª linha é o cabeçalho, com as colunas (em qualquer ordem):
//   nome;setor;dia;mes           (obrigatórias: nome; demais opcionais)
//   + opcionais: email, ramal, cargo
// Separador ; ou , (detectado pelo cabeçalho). Aceita "mês" com acento,
// maiúsculas/minúsculas e BOM UTF-8/UTF-16 do Excel/Windows.

const APELIDOS: Record<string, string> = {
  CEDIDO: 'CEDIDA',
  GABINTE: 'GABINETE',
  SUGESPE: 'SECOGE',
};

function decodificar(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  return buf.toString('utf8');
}

// Divide uma linha CSV respeitando aspas ("São Paulo; SP" não é dividido).
function dividirLinha(linha: string, sep: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let emAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (emAspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') emAspas = false;
      else atual += c;
    } else if (c === '"') emAspas = true;
    else if (c === sep) {
      campos.push(atual);
      atual = '';
    } else atual += c;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

function normalizarColuna(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

// Nomes de coluna aceitos -> campo canônico.
const COLUNAS: Record<string, string> = {
  nome: 'nome',
  name: 'nome',
  setor: 'setor',
  departamento: 'setor',
  dia: 'dia',
  mes: 'mes',
  email: 'email',
  'e-mail': 'email',
  ramal: 'ramal',
  telefone: 'ramal',
  cargo: 'cargo',
};

export function lerCsvPessoas(arquivo: string): ResultadoLeitura {
  const texto = decodificar(readFileSync(arquivo));
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (linhas.length === 0) return { registros: [], avisos: ['arquivo vazio'] };

  const sep = (linhas[0].match(/;/g) ?? []).length >= (linhas[0].match(/,/g) ?? []).length ? ';' : ',';
  const cabecalho = dividirLinha(linhas[0], sep).map((c) => COLUNAS[normalizarColuna(c)] ?? null);
  if (!cabecalho.includes('nome')) {
    return {
      registros: [],
      avisos: [
        `cabeçalho não reconhecido: "${linhas[0]}"`,
        'esperado (em qualquer ordem, separado por ; ou ,): nome;setor;dia;mes[;email;ramal;cargo]',
      ],
    };
  }

  const registros: PessoaImportada[] = [];
  const avisos: string[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const campos = dividirLinha(linhas[i], sep);
    const reg: Record<string, string> = {};
    cabecalho.forEach((col, j) => {
      if (col && campos[j] !== undefined) reg[col] = campos[j];
    });

    const nome = (reg.nome ?? '').trim();
    if (!nome) {
      avisos.push(`linha ${i + 1}: sem nome — ignorada`);
      continue;
    }
    const numero = (v: string | undefined, min: number, max: number): number | null => {
      const n = Number((v ?? '').trim());
      return Number.isInteger(n) && n >= min && n <= max ? n : null;
    };
    const dia = numero(reg.dia, 1, 31);
    const mes = numero(reg.mes, 1, 12);
    if ((reg.dia || reg.mes) && (dia === null || mes === null)) {
      avisos.push(`linha ${i + 1}: dia/mês inválidos ("${reg.dia ?? ''}"/"${reg.mes ?? ''}") — importada sem aniversário`);
    }

    const setorLimpo = reg.setor ? reg.setor.replace(/\\/g, '/').trim() : null;
    const prefixo = setorLimpo ? setorLimpo.split('/')[0].trim().toUpperCase() : null;
    const codigo = prefixo ? (APELIDOS[prefixo] ?? prefixo) : null;

    registros.push({
      name: nome,
      departmentCode: codigo,
      departmentFull: setorLimpo,
      birthDay: dia !== null && mes !== null ? dia : null,
      birthMonth: dia !== null && mes !== null ? mes : null,
      email: reg.email?.trim() || null,
      phoneExtension: reg.ramal?.trim() || null,
      cargo: reg.cargo?.trim() || null,
    });
  }

  return { registros, avisos };
}
