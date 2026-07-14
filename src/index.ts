import { caminhoBanco, config, DATA_DIR, sondaDeEscrita } from './config';
import { RepositorioJson } from './data/repositorioJson';
import { criarApp } from './http/app';
import { seed } from './seed';

async function main(): Promise<void> {
  // Falha cedo e claro se data/ não for gravável — senão o app sobe "meio
  // funcionando": leitura OK, mas todo cadastro/importação falharia depois.
  const erroEscrita = sondaDeEscrita();
  if (erroEscrita) {
    console.error(`ERRO: não consigo escrever no diretório de dados (${DATA_DIR}):`);
    console.error(`  ${erroEscrita}`);
    console.error('Verifique: permissão da pasta, antivírus, ou a pasta do app dentro de');
    console.error('área sincronizada (OneDrive) / protegida (Arquivos de Programas).');
    console.error('Diagnóstico completo: npm run doctor');
    process.exit(1);
  }

  const repo = new RepositorioJson(caminhoBanco());
  await repo.iniciar();
  await seed(repo);

  const app = criarApp(repo);
  app.listen(config.port, config.host, async () => {
    console.log(`Intranet SEPLAG no ar em http://${config.host}:${config.port}`);
    console.log(`Dados: ${caminhoBanco()}`);
    console.log(`Pessoas carregadas: ${await repo.pessoas.contar()}`);
    console.log('Abra a porta no firewall para os demais PCs da rede acessarem.');
  });
}

main();
