// Importa os funcionários REAIS a partir do SQL fornecido (INSERT INTO
// employees ...), gravando no store local (data/intranet.json). O SQL de dados
// reais e o data/ NÃO são versionados — ver .gitignore.
//
// Uso:
//   npm run importar-funcionarios -- /caminho/employees_real_data_complete.sql
//
import { existsSync, readFileSync } from 'node:fs';
import { seed } from '../src/seed';
import * as store from '../src/store';

// Lê o arquivo respeitando o BOM: arquivos salvos no Windows (PowerShell,
// Bloco de Notas) costumam vir em UTF-16 ou UTF-8 com BOM — lidos como utf8
// puro virariam lixo e o parser não reconheceria nenhuma linha.
function lerTexto(arquivo: string): string {
  const buf = readFileSync(arquivo);
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  return buf.toString('utf8');
}

interface Registro {
  name: string;
  email: string | null;
  phoneExtension: string | null;
  departmentCode: string | null;
  departmentFull: string | null;
  birthDay: number | null;
  birthMonth: number | null;
}

// Um campo é NULL (literal) ou uma string entre aspas simples (com '' escapado).
const CAMPO_TEXTO = "(NULL|'(?:[^']|'')*')";
const CAMPO_NUM = '(NULL|\\d+)';
const LINHA = new RegExp(
  '\\(\\s*' +
    "'((?:[^']|'')*)'" + // name (sempre presente)
    '\\s*,\\s*' + CAMPO_TEXTO + // email
    '\\s*,\\s*' + CAMPO_TEXTO + // phone_extension
    '\\s*,\\s*' + CAMPO_TEXTO + // department_full
    '\\s*,\\s*' + CAMPO_NUM + // birth_day
    '\\s*,\\s*' + CAMPO_NUM + // birth_month
    "\\s*,\\s*\\(\\s*SELECT id FROM departments WHERE code = '([^']+)'\\s*\\)" +
    '\\s*\\)',
  'g',
);

function texto(raw: string): string | null {
  if (raw === 'NULL') return null;
  return raw.slice(1, -1).replace(/''/g, "'").trim() || null;
}

function numero(raw: string): number | null {
  return raw === 'NULL' ? null : Number(raw);
}

function parse(sql: string): Registro[] {
  const registros: Registro[] = [];
  for (const m of sql.matchAll(LINHA)) {
    registros.push({
      name: m[1].replace(/''/g, "'").trim(),
      email: texto(m[2]),
      phoneExtension: texto(m[3]),
      departmentFull: texto(m[4]),
      birthDay: numero(m[5]),
      birthMonth: numero(m[6]),
      departmentCode: m[7],
    });
  }
  return registros;
}

async function main(): Promise<void> {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('Uso: npm run importar-funcionarios -- <arquivo.sql>');
    process.exit(1);
  }
  if (!existsSync(arquivo)) {
    console.error(`Arquivo não encontrado: ${arquivo}`);
    console.error('Confira o caminho (no Windows, use aspas se houver espaços).');
    process.exit(1);
  }
  const sql = lerTexto(arquivo);
  const registros = parse(sql);
  if (registros.length === 0) {
    console.error(`Nenhum registro reconhecido em ${arquivo} (${sql.length} caracteres lidos).`);
    console.error(
      "Formato esperado por linha: ('Nome', 'email', 'ramal', 'setor', dia, mes, (SELECT id FROM departments WHERE code = 'SIGLA'))",
    );
    console.error('Confira se é o arquivo certo (employees_real_data_complete.sql, não add_all_employees.sql).');
    console.error(`Diagnóstico completo: npm run doctor -- ${arquivo}`);
    process.exit(1);
  }

  await store.iniciar();
  await seed(); // garante departamentos/admin antes de vincular
  const total = await store.replaceEmployees(registros);

  const semSetor = registros.filter((r) => !store.getDepartmentByCode(r.departmentCode ?? '')).length;
  console.log(`Importados ${total} funcionários.`);
  if (semSetor > 0) {
    console.warn(`Aviso: ${semSetor} registro(s) referenciam um code de setor não cadastrado.`);
  }
}

main();
