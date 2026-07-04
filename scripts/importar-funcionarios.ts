// Importa os funcionários REAIS a partir do SQL fornecido (INSERT INTO
// employees ...), gravando no store local (data/intranet.json). O SQL de dados
// reais e o data/ NÃO são versionados — ver .gitignore.
//
// Uso:
//   npm run importar-funcionarios -- /caminho/employees_real_data_complete.sql
//
import { readFileSync } from 'node:fs';
import { seed } from '../src/seed';
import * as store from '../src/store';

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
  const sql = readFileSync(arquivo, 'utf8');
  const registros = parse(sql);
  if (registros.length === 0) {
    console.error('Nenhum registro reconhecido no SQL. Formato esperado: INSERT INTO employees (...) VALUES (...).');
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
