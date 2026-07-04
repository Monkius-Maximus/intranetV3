import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DATA_DIR } from './config';

// Um único arquivo JSON guarda todo o estado (adaptado do padrão do glossário:
// escrita atômica via arquivo temporário + rename).
const ARQUIVO = process.env.INTRANET_DB ?? join(DATA_DIR, 'intranet.json');

export function caminhoArquivo(): string {
  return ARQUIVO;
}

// Lê o estado no início. Se o arquivo não existe (1ª execução), retorna o
// padrão. Se existir mas estiver corrompido, FALHA ALTO — não mascara perda de
// dados começando vazio (diferença deliberada do glossário, que era público).
export async function carregar<T>(padrao: T): Promise<T> {
  try {
    const texto = await readFile(ARQUIVO, 'utf8');
    return JSON.parse(texto) as T;
  } catch (e: unknown) {
    const erro = e as NodeJS.ErrnoException;
    if (erro?.code === 'ENOENT') {
      return padrao;
    }
    throw new Error(`Arquivo de dados ilegível (${ARQUIVO}): ${erro?.message ?? String(e)}`);
  }
}

// Serializa as gravações numa corrente para não intercalar escritas.
let cadeia: Promise<void> = Promise.resolve();

export function salvar(snapshot: () => unknown): Promise<void> {
  cadeia = cadeia.then(
    () => escrever(snapshot()),
    () => escrever(snapshot()),
  );
  return cadeia;
}

async function escrever(estado: unknown): Promise<void> {
  const texto = JSON.stringify(estado, null, 2);
  await mkdir(dirname(ARQUIVO), { recursive: true });
  const temporario = `${ARQUIVO}.tmp`;
  await writeFile(temporario, texto, 'utf8');
  await rename(temporario, ARQUIVO); // troca atômica no sistema de arquivos
}
