import crypto from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Falha cedo e claro em Node antigo — em vez de um erro críptico mais adiante.
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 18) {
  console.error(`Node ${process.versions.node} é antigo demais: este projeto requer Node 18 ou superior.`);
  console.error('Instale o Node LTS (nodejs.org) e rode tudo de novo a partir do `npm install`.');
  process.exit(1);
}

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));

// Diretório de dados locais (arquivo do "banco" JSON, segredo JWT). Fica fora do
// git — ver .gitignore. Pode ser realocado com INTRANET_DATA (ex.: um volume).
export const DATA_DIR = process.env.INTRANET_DATA ?? join(raiz, 'data');

// Caminho do arquivo de banco (usado pelo repositório JSON e pelo backup).
export function caminhoBanco(): string {
  return process.env.INTRANET_DB ?? join(DATA_DIR, 'intranet.json');
}

function garantirDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Segredo do JWT: usa JWT_SECRET se definido; senão gera uma vez e guarda em
// data/jwt-secret.key (600), para os tokens sobreviverem a reinícios.
function carregarSegredo(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  garantirDir(DATA_DIR);
  const arq = join(DATA_DIR, 'jwt-secret.key');
  if (existsSync(arq)) {
    return readFileSync(arq, 'utf8').trim();
  }
  const segredo = crypto.randomBytes(48).toString('hex');
  writeFileSync(arq, segredo, { mode: 0o600 });
  try {
    chmodSync(arq, 0o600);
  } catch {
    // Em alguns sistemas de arquivos o chmod pode não se aplicar; ignora.
  }
  return segredo;
}

export const config = {
  // 0.0.0.0: o próprio servidor é exposto na LAN (modelo "abra a porta no
  // firewall"). O acesso é protegido por login — ver src/auth.ts.
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: carregarSegredo(),
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN ?? 28800),
  // Bootstrap do primeiro admin (só na 1ª execução, se não houver usuários).
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@intranet.local',
  adminPassword: process.env.ADMIN_PASSWORD, // se ausente, gera e imprime uma vez
  bcryptCost: 12,
} as const;
