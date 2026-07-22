import { z } from 'zod';

export interface Departamento {
  id: number;
  code: string; // sigla usada nas pessoas e nos filtros (ex.: SECOGE)
  name: string; // nome por extenso
  description?: string;
  parent?: string | null; // sigla da secretaria-mãe quando é um núcleo (ex.: NSI -> SECOGE); null/ausente = topo
}

// ----------------------------------------------------------------- validação
// Sigla em caixa alta, sem espaços — é a chave usada em pessoas.departmentCode.
const code = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(/^[\p{L}0-9._-]+$/u, 'sigla sem espaços (letras, números, . _ -)')
  .transform((s) => s.toUpperCase());

export const criarSetorSchema = z.object({
  code,
  // Nome é OPCIONAL: quem quer trabalhar só com siglas deixa em branco e o
  // repositório assume a própria sigla como nome.
  name: z.string().trim().max(255).optional(),
  description: z.string().trim().max(255).default(''),
  parent: code.nullable().optional(), // núcleo dentro de uma secretaria
});

export const atualizarSetorSchema = z
  .object({
    code,
    name: z.string().trim().max(255), // pode vir vazio -> vira a sigla (siglas-only)
    description: z.string().trim().max(255),
    parent: code.nullable(),
  })
  .partial();

// Mover/mesclar: reatribui as pessoas do setor para outro (e, opcionalmente,
// exclui o setor de origem depois de esvaziá-lo).
export const moverPessoasSchema = z.object({
  destino: code,
  excluirOrigem: z.boolean().default(false),
});

export type DadosNovoSetor = z.infer<typeof criarSetorSchema>;
export type PatchSetor = z.infer<typeof atualizarSetorSchema>;
