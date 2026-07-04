import { app } from './app';
import { config } from './config';
import { caminhoArquivo } from './persistencia';
import { seed } from './seed';
import * as store from './store';

async function main(): Promise<void> {
  await store.iniciar();
  await seed();
  app.listen(config.port, config.host, () => {
    console.log(`Intranet SEPLAG no ar em http://${config.host}:${config.port}`);
    console.log(`Dados: ${caminhoArquivo()}`);
    console.log(`Funcionários carregados: ${store.countEmployees()}`);
    console.log('Abra a porta no firewall para os demais PCs da rede acessarem.');
  });
}

main();
