import { z } from 'zod';

// Eventos da agenda (card "Próximos eventos" do dashboard). Gerido pelo admin;
// leitura pública. Substitui o dado de exemplo que existia no protótipo.

export interface Evento {
  id: number;
  titulo: string;
  data: string; // YYYY-MM-DD
  hora: string | null; // texto livre curto ("10h", "14h30")
  local: string | null; // "Sala 3", "Auditório"…
}

export const criarEventoSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD'),
  hora: z.string().trim().max(20).nullable().default(null),
  local: z.string().trim().max(80).nullable().default(null),
});

export const atualizarEventoSchema = criarEventoSchema.partial();

export type DadosNovoEvento = z.infer<typeof criarEventoSchema>;
export type PatchEvento = z.infer<typeof atualizarEventoSchema>;
