// Importa o quadro de pessoas a partir de um CSV simples — o plano B quando o
// XLSX não é reconhecido: abra a planilha no Excel e "Salvar como > CSV".
//
// Uso: npm run importar-csv -- /caminho/pessoas.csv
// Formato (1ª linha = cabeçalho, ; ou ,): nome;setor;dia;mes[;email;ramal;cargo]
import { existsSync } from 'node:fs';
import { caminhoBanco } from '../src/config';
import { RepositorioJson } from '../src/data/repositorioJson';
import { mesclarPessoas } from '../src/ingest';
import { seed } from '../src/seed';
import { lerCsvPessoas } from '../src/sources/csvPessoas';

async function main(): Promise<void> {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('Uso: npm run importar-csv -- <arquivo.csv>');
    process.exit(1);
  }
  if (!existsSync(arquivo)) {
    console.error(`Arquivo não encontrado: ${arquivo}`);
    console.error('Confira o caminho (no Windows, use aspas se houver espaços).');
    process.exit(1);
  }

  const { registros, avisos } = lerCsvPessoas(arquivo);
  if (avisos.length > 0) {
    console.warn(`${avisos.length} aviso(s) na leitura:`);
    for (const a of avisos.slice(0, 10)) console.warn(`  - ${a}`);
  }
  if (registros.length === 0) {
    console.error(`Nenhum registro reconhecido em ${arquivo}.`);
    console.error('Formato esperado (1ª linha = cabeçalho): nome;setor;dia;mes[;email;ramal;cargo]');
    process.exit(1);
  }

  const repo = new RepositorioJson(caminhoBanco());
  await repo.iniciar();
  await seed(repo);
  const r = await mesclarPessoas(repo, registros, 'csv');

  console.log(`Pessoas: ${r.total} (novos ${r.novos}, atualizados ${r.atualizados}, preservados ${r.preservados}).`);
  if (Object.keys(r.setoresDesconhecidos).length > 0) {
    console.warn('Setores sem código conhecido (mantidos só como texto):', JSON.stringify(r.setoresDesconhecidos));
  }
  console.log('Confira em /api/health (contagem) e na tela Ramais. Suba o app com: npm start');
}

main();
