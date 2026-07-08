import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// I/O atômico de um arquivo JSON (escrita via temporário + rename). Genérico:
// o repositório JSON usa isto; um repositório SQLite/API não usaria nada disto.
export async function lerJson<T>(caminho: string, padrao: T): Promise<T> {
  try {
    return JSON.parse(await readFile(caminho, 'utf8')) as T;
  } catch (e: unknown) {
    const erro = e as NodeJS.ErrnoException;
    if (erro?.code === 'ENOENT') return padrao;
    // Corrupção: falha alto — não mascara perda de dados começando vazio.
    throw new Error(`Arquivo de dados ilegível (${caminho}): ${erro?.message ?? String(e)}`);
  }
}

export function criarGravador(caminho: string): (estado: unknown) => Promise<void> {
  let cadeia: Promise<void> = Promise.resolve();
  const escrever = async (estado: unknown): Promise<void> => {
    const texto = JSON.stringify(estado, null, 2);
    await mkdir(dirname(caminho), { recursive: true });
    const tmp = `${caminho}.tmp`;
    await writeFile(tmp, texto, 'utf8');
    await rename(tmp, caminho);
  };
  // Serializa as gravações numa corrente para não intercalar escritas.
  return (estado: unknown) => {
    cadeia = cadeia.then(() => escrever(estado), () => escrever(estado));
    return cadeia;
  };
}
