import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { FalhaDeGravacao } from '../domain/erros';

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

// No Windows, o rename pode falhar TRANSITORIAMENTE (EPERM/EBUSY/EACCES)
// quando um antivírus ou o OneDrive segura o arquivo recém-escrito. Tentamos
// de novo com espera crescente antes de desistir — e, se desistirmos, o erro
// diz exatamente o que verificar.
const CODIGOS_TRANSITORIOS = new Set(['EPERM', 'EBUSY', 'EACCES']);
const TENTATIVAS = 6;

async function renameComRetry(tmp: string, caminho: string): Promise<void> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      await rename(tmp, caminho);
      return;
    } catch (e: unknown) {
      const erro = e as NodeJS.ErrnoException;
      if (!CODIGOS_TRANSITORIOS.has(erro?.code ?? '') || tentativa >= TENTATIVAS) {
        throw new FalhaDeGravacao(
          `não consegui gravar o banco em ${caminho} (${erro?.code ?? 'erro'}: ${erro?.message ?? String(e)}). ` +
            'Verifique: permissão de escrita na pasta data/, antivírus segurando o arquivo, ' +
            'ou a pasta do app dentro de área sincronizada (OneDrive) / protegida (Arquivos de Programas).',
        );
      }
      await new Promise((r) => setTimeout(r, 50 * 2 ** (tentativa - 1))); // 50ms…1.6s
    }
  }
}

export function criarGravador(caminho: string): (estado: unknown) => Promise<void> {
  let cadeia: Promise<void> = Promise.resolve();
  const escrever = async (estado: unknown): Promise<void> => {
    const texto = JSON.stringify(estado, null, 2);
    await mkdir(dirname(caminho), { recursive: true });
    const tmp = `${caminho}.tmp`;
    await writeFile(tmp, texto, 'utf8');
    await renameComRetry(tmp, caminho);
  };
  // Serializa as gravações numa corrente para não intercalar escritas.
  return (estado: unknown) => {
    cadeia = cadeia.then(() => escrever(estado), () => escrever(estado));
    return cadeia;
  };
}
