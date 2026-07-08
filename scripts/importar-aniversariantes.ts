// Importa o quadro de pessoas a partir do XLSX de ANIVERSARIANTES do Seplagnet.
// Fino de propósito: só orquestra a ORIGEM (sources/) + a INGESTÃO (ingest).
//
// Uso: npm run importar-aniversariantes -- /caminho/ANIVERSARIANTES_SEPLAG_2026.xlsx
import { existsSync } from 'node:fs';
import { caminhoBanco } from '../src/config';
import { RepositorioJson } from '../src/data/repositorioJson';
import { mesclarPessoas } from '../src/ingest';
import { seed } from '../src/seed';
import { lerXlsxAniversariantes } from '../src/sources/xlsxAniversariantes';

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

  const { registros, avisos } = await lerXlsxAniversariantes(arquivo);
  if (registros.length === 0) {
    console.error(`Nenhum registro reconhecido em ${arquivo}.`);
    console.error('Formato esperado: cabeçalhos "Aniversariantes do mês de <Mês>" + linhas dia|nome|setor.');
    process.exit(1);
  }

  const repo = new RepositorioJson(caminhoBanco());
  await repo.iniciar();
  await seed(repo);
  const r = await mesclarPessoas(repo, registros, 'xlsx-aniversariantes');

  console.log(`Pessoas: ${r.total} (novos ${r.novos}, atualizados ${r.atualizados}, preservados ${r.preservados}).`);
  console.log('E-mail e ramal não existem nesta fonte — preencha pela tela do admin quando tiver os dados.');
  if (Object.keys(r.setoresDesconhecidos).length > 0) {
    console.warn('Setores sem código conhecido (mantidos só como texto):', JSON.stringify(r.setoresDesconhecidos));
  }
  if (avisos.length > 0) {
    console.warn(`${avisos.length} linha(s) ignorada(s):`);
    for (const a of avisos.slice(0, 10)) console.warn(`  - ${a}`);
  }
}

main();
