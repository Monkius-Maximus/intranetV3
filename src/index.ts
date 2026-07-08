import { caminhoBanco, config } from './config';
import { RepositorioJson } from './data/repositorioJson';
import { criarApp } from './http/app';
import { seed } from './seed';

async function main(): Promise<void> {
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
