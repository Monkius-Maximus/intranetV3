import { readFileSync } from 'node:fs';
import type { PessoaImportada } from '../domain/pessoa';
import type { ResultadoLeitura } from './contrato';

// Origem: SQL "INSERT INTO employees (...)" (formato do employees_real_data).
// Fornece núcleo + e-mail + ramal (mais rico que o XLSX de aniversariantes).

const CAMPO_TEXTO = "(NULL|'(?:[^']|'')*')";
const CAMPO_NUM = '(NULL|\\d+)';
const LINHA = new RegExp(
  '\\(\\s*' +
    "'((?:[^']|'')*)'" +
    '\\s*,\\s*' + CAMPO_TEXTO +
    '\\s*,\\s*' + CAMPO_TEXTO +
    '\\s*,\\s*' + CAMPO_TEXTO +
    '\\s*,\\s*' + CAMPO_NUM +
    '\\s*,\\s*' + CAMPO_NUM +
    "\\s*,\\s*\\(\\s*SELECT id FROM departments WHERE code = '([^']+)'\\s*\\)" +
    '\\s*\\)',
  'g',
);

// Lê respeitando BOM (arquivos salvos no Windows costumam vir em UTF-16).
function lerTexto(arquivo: string): string {
  const buf = readFileSync(arquivo);
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  return buf.toString('utf8');
}

function texto(raw: string): string | null {
  if (raw === 'NULL') return null;
  return raw.slice(1, -1).replace(/''/g, "'").trim() || null;
}

function numero(raw: string): number | null {
  return raw === 'NULL' ? null : Number(raw);
}

// Nota: o SQL também traz e-mail (m[2]) e ramal (m[3]); como ambos são
// ENRIQUECIMENTO e o merge só escreve o núcleo, hoje eles não são aplicados
// numa reimportação sobre alguém já enriquecido. Mantemos só o núcleo aqui
// para um único caminho de merge; enriquecer por importação será um passo
// explícito futuro (com política de "não sobrescrever preenchido à mão").
export function lerSqlEmployees(arquivo: string): ResultadoLeitura {
  const sql = lerTexto(arquivo);
  const registros: PessoaImportada[] = [];
  for (const m of sql.matchAll(LINHA)) {
    registros.push({
      name: m[1].replace(/''/g, "'").trim(),
      departmentCode: m[7],
      departmentFull: texto(m[4]),
      birthDay: numero(m[5]),
      birthMonth: numero(m[6]),
    });
  }
  return { registros, avisos: [] };
}
