import { z } from 'zod';

// Tiles de "Acesso rápido" do dashboard — dirigidos por banco, como a
// navegação: o admin edita rótulo, destino, ícone e cor pela tela.
//
// URL aceita dois formatos:
//   https://…   → abre o sistema externo em nova aba
//   #view       → navega dentro da intranet (ex.: #ramais, #aniversariantes)

export interface Tile {
  id: number;
  label: string;
  icon: string; // nome Material Symbols (restrito à lista embutida na fonte local)
  cor: string; // cor de fundo (paleta do design)
  url: string;
  ordem: number;
}

// Paleta permitida — as cores do design system (fundo branco + texto branco).
export const CORES_TILE = [
  '#1e73be', // azul
  '#1f8a52', // verde
  '#c46a12', // âmbar
  '#6b3fd1', // roxo
  '#b23c6e', // rosa
  '#0f7a86', // teal
  '#103a6b', // navy
  '#c0393e', // vermelho
] as const;

// Ícones permitidos — precisam existir no subconjunto LOCAL da fonte
// (public/fonts). Ao acrescentar um nome aqui, regenere o subconjunto.
export const ICONES_TILE = [
  'badge', 'request_quote', 'event_available', 'support_agent', 'menu_book', 'groups',
  'contacts', 'campaign', 'description', 'gavel', 'local_library', 'folder_open',
  'school', 'computer', 'print', 'mail', 'receipt_long', 'savings',
  'health_and_safety', 'engineering', 'apartment', 'public', 'help', 'build',
  'assignment', 'calendar_month', 'forum', 'cloud', 'verified_user', 'home',
] as const;

const url = z
  .string()
  .trim()
  .min(1)
  .max(500)
  // Interno: #ramais, #aniversariantes ou #r:<chave> (páginas criadas pela tela).
  .refine((v) => /^https?:\/\/.+/.test(v) || /^#[a-z][a-z0-9_:-]*$/.test(v), {
    message: 'use https://… (sistema externo) ou #view (interno, ex.: #ramais, #r:estoque)',
  });

export const criarTileSchema = z.object({
  label: z.string().trim().min(1).max(40),
  icon: z.enum(ICONES_TILE),
  cor: z.enum(CORES_TILE),
  url,
});

export const atualizarTileSchema = criarTileSchema.partial();

export type DadosNovoTile = z.infer<typeof criarTileSchema>;
export type PatchTile = z.infer<typeof atualizarTileSchema>;
