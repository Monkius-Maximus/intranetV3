import type { PessoaImportada } from '../domain/pessoa';

// Toda origem de dados (XLSX, SQL, Forms, API, cadastro manual…) produz este
// mesmo formato normalizado. O serviço de ingestão (src/ingest.ts) mescla o
// resultado no repositório, sem conhecer o formato de origem.
export interface ResultadoLeitura {
  registros: PessoaImportada[];
  avisos: string[]; // linhas ignoradas, formatos estranhos, etc.
}
