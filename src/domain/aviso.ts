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

export type DadosNovoAviso = z.infer<typeof criarAvisoSchema>;
