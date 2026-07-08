// Importa o quadro de pessoas a partir do SQL "INSERT INTO employees".
// Fino: orquestra a ORIGEM (sources/sqlEmployees) + a INGESTÃO (ingest).
//
// Uso: npm run importar-funcionarios -- /caminho/employees_real_data_complete.sql
import { existsSync } from 'node:fs';
import { caminhoBanco } from '../src/config';
import { RepositorioJson } from '../src/data/repositorioJson';
import { mesclarPessoas } from '../src/ingest';
import { seed } from '../src/seed';
import { lerSqlEmployees } from '../src/sources/sqlEmployees';

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

  const { registros } = lerSqlEmployees(arquivo);
  if (registros.length === 0) {
    console.error(`Nenhum registro reconhecido em ${arquivo}.`);
    console.error("Formato: ('Nome','email','ramal','setor',dia,mes,(SELECT id FROM departments WHERE code='SIGLA'))");
    console.error('Confira se é o arquivo certo (employees_real_data_complete.sql).');
    process.exit(1);
  }

  const repo = new RepositorioJson(caminhoBanco());
  await repo.iniciar();
  await seed(repo);
  const r = await mesclarPessoas(repo, registros, 'sql-employees');

  console.log(`Pessoas: ${r.total} (novos ${r.novos}, atualizados ${r.atualizados}, preservados ${r.preservados}).`);
  if (Object.keys(r.setoresDesconhecidos).length > 0) {
    console.warn('Setores sem código conhecido:', JSON.stringify(r.setoresDesconhecidos));
  }
}

main();
