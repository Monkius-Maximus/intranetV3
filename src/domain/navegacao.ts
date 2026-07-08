import { z } from 'zod';

// Navegação dirigida por banco: um só modelo alimenta duas vistas — a barra
// superior (grupos como menus/dropdowns) e a seção de destaque (grupos com
// `destaque` viram cards de "Links úteis"). Adicionar/remover/reordenar é dado,
// não código.

export interface GrupoMenu {
  id: number;
  nome: string; // "Sistemas", "Servidor", "Transparência"…
  ordem: number;
  url: string | null; // link direto (ex.: "Transparência"); null = dropdown de itens
  destaque: boolean; // também aparece como cards na seção de destaque
}

export interface ItemMenu {
  id: number;
  grupoId: number;
  label: string;
  url: string;
  descricao: string | null;
  ordem: number;
}

// Vista montada entregue ao cliente.
export interface GrupoComItens extends GrupoMenu {
  itens: ItemMenu[];
}

export const criarGrupoSchema = z.object({
  nome: z.string().trim().min(1).max(60),
  url: z.string().trim().url().max(500).nullable().default(null),
  destaque: z.boolean().default(false),
});

export const criarItemSchema = z.object({
  grupoId: z.number().int().positive(),
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().url().max(500),
  descricao: z.string().trim().max(300).nullable().default(null),
});

// Reordenar: lista de ids na nova ordem.
export const reordenarSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export type DadosNovoGrupo = z.infer<typeof criarGrupoSchema>;
export type DadosNovoItem = z.infer<typeof criarItemSchema>;
