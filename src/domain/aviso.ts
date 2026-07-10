import { z } from 'zod';

export interface Aviso {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  createdBy: number | null;
  createdAt: string;
}

export const criarAvisoSchema = z.object({
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().min(1).max(5000),
  pinned: z.boolean().default(false),
});

// Atualização parcial: só o que vier é alterado (SEM defaults — senão um PATCH
// apagaria campos não enviados).
export const atualizarAvisoSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    body: z.string().trim().min(1).max(5000),
    pinned: z.boolean(),
  })
  .partial();

export type DadosNovoAviso = z.infer<typeof criarAvisoSchema>;
export type PatchAviso = z.infer<typeof atualizarAvisoSchema>;
