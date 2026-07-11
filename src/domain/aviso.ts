import { z } from 'zod';

// Categorias de comunicado — dirigem o color-coding dos cards na UI.
// (A cor em si é decisão de apresentação; o domínio guarda só a categoria.)
export const CATEGORIAS_AVISO = ['geral', 'ti', 'rh', 'urgente'] as const;
export type CategoriaAviso = (typeof CATEGORIAS_AVISO)[number];

export interface Aviso {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  categoria: CategoriaAviso;
  autor: string | null; // nome de quem publicou (denormalizado do token)
  createdBy: number | null;
  createdAt: string;
}

export const criarAvisoSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(5000),
  pinned: z.boolean().default(false),
  categoria: z.enum(CATEGORIAS_AVISO).default('geral'),
});

// Atualização parcial: só o que vier é alterado (SEM defaults — senão um PATCH
// apagaria campos não enviados).
export const atualizarAvisoSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    body: z.string().trim().min(1).max(5000),
    pinned: z.boolean(),
    categoria: z.enum(CATEGORIAS_AVISO),
  })
  .partial();

export type DadosNovoAviso = z.infer<typeof criarAvisoSchema>;
export type PatchAviso = z.infer<typeof atualizarAvisoSchema>;
