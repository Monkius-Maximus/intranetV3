import { z } from 'zod';

export interface Departamento {
  id: number;
  code: string; // sigla usada nas pessoas e nos filtros (ex.: SECOGE)
  name: string; // nome por extenso
  description?: string;
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
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(255).default(''),
});

export const atualizarSetorSchema = z
  .object({
    code,
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(255),
  })
  .partial();

export type DadosNovoSetor = z.infer<typeof criarSetorSchema>;
export type PatchSetor = z.infer<typeof atualizarSetorSchema>;
