import { networkInterfaces } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { caminhoBanco, config, DATA_DIR, sondaDeEscrita } from './config';
import { RepositorioJson } from './data/repositorioJson';
import { criarApp } from './http/app';
import { seed } from './seed';

// IPs reais da LAN — as URLs que os OUTROS dispositivos usam ("0.0.0.0" é só
// a instrução de escutar em todas as placas, não é um endereço acessável).
function ipsDaLan(): string[] {
  const ips: string[] = [];
  for (const placas of Object.values(networkInterfaces())) {
    for (const i of placas ?? []) {
      if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
    }
  }
  return ips;
}

function dentroDoWsl(): boolean {
  try {
    return process.platform === 'linux' && existsSync('/proc/version') && /microsoft/i.test(readFileSync('/proc/version', 'utf8'));
  } catch {
    return false;
  }
}

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
    console.log('Intranet SEPLAG no ar.');
    console.log(`  Nesta máquina : http://localhost:${config.port}`);
    for (const ip of ipsDaLan()) {
      console.log(`  Na rede       : http://${ip}:${config.port}   <- passe esta URL aos demais PCs`);
    }
    console.log(`Dados: ${caminhoBanco()}`);
    console.log(`Pessoas carregadas: ${await repo.pessoas.contar()}`);
    if (dentroDoWsl()) {
      console.warn('AVISO: rodando dentro do WSL — outros dispositivos da rede NÃO alcançam');
      console.warn('portas do WSL sem configuração extra. Para servir a LAN, rode no Windows');
      console.warn('nativo (PowerShell) ou ative networkingMode=mirrored no .wslconfig.');
    }
    console.log('Se os outros PCs não acessarem, veja "Ninguém consegue acessar" no DEPLOY.md.');
  });
}

main();
