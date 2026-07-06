// Copia o banco (data/intranet.json) para backups/backup-<timestamp>.json.
// Todo o estado da aplicação vive nesse único arquivo; restaurar = copiar o
// backup de volta para data/intranet.json e reiniciar o servidor.
//
// Uso:  npm run backup
//
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { caminhoArquivo } from '../src/persistencia';

const origem = caminhoArquivo();
if (!existsSync(origem)) {
  console.error(`Nada a copiar: ${origem} ainda não existe (o servidor nunca rodou?).`);
  process.exit(1);
}

const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const destino = join('backups', `backup-${ts}.json`);
mkdirSync('backups', { recursive: true });
copyFileSync(origem, destino);
console.log(`Backup criado: ${destino}`);
