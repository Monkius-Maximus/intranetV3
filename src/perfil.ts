import type { z } from 'zod';
import type { DadosNovoTile } from './domain/tile';
import type { criarRecursoSchema } from './domain/recurso';

// ===========================================================================
// PERFIL DO PROJETO — o que troca quando o assunto do site troca.
//
// Um perfil reúne a IDENTIDADE (nome, organização, marca, logo) e o CONTEÚDO
// INICIAL (setores, navegação, tiles e páginas). O resto do código não conhece
// nenhum assunto: para nascer uma intranet nova, escreve-se um perfil novo em
// `src/perfis/` e pronto.
//
// Escolha do perfil pela variável de ambiente PERFIL (padrão: seplag):
//     PERFIL=casa npm start
//
// O conteúdo inicial só é aplicado na PRIMEIRA execução, com o banco vazio —
// depois disso quem manda é o que foi editado pela tela.
// ===========================================================================

export interface DepartamentoSeed {
  code: string;
  name: string;
  description: string;
}

export interface GrupoNavegacaoSeed {
  nome: string;
  url?: string;
  destaque?: boolean;
  itens: { label: string; url: string; descricao?: string }[];
}

// Página criada de saída (recurso dirigido por dados). Aceita a forma de
// ENTRADA do schema: campos como `obrigatorio` e `opcoes` podem ser omitidos,
// pois o seed valida e completa os padrões.
export type RecursoSeed = z.input<typeof criarRecursoSchema>;

export interface Perfil {
  /** Nome do produto, na barra lateral e no login (ex.: "Intranet"). */
  nome: string;
  /** A quem pertence — linha de baixo da marca (ex.: "SEPLAG", "Casa"). */
  organizacao: string;
  /** Iniciais do quadrinho da marca quando não há logo (2–3 letras). */
  marca: string;
  /** Caminho de uma imagem em `public/` (ex.: "/logo.svg"). Definido, substitui as iniciais. */
  logo: string | null;

  // ---- conteúdo inicial (só na primeira execução) ----
  departamentos: DepartamentoSeed[];
  navegacao: GrupoNavegacaoSeed[];
  tiles: DadosNovoTile[];
  /** Páginas que já nascem com o sistema; opcional. */
  recursos?: RecursoSeed[];
}

// Os perfis disponíveis. Acrescentar um projeto = criar o arquivo e listar aqui.
import { seplag } from './perfis/seplag';
import { casa } from './perfis/casa';

export const PERFIS: Record<string, Perfil> = { seplag, casa };

const escolhido = (process.env.PERFIL ?? 'seplag').trim().toLowerCase();
if (!PERFIS[escolhido]) {
  // Falha cedo e clara: melhor que subir com a identidade errada.
  throw new Error(
    `PERFIL desconhecido: "${escolhido}". Disponíveis: ${Object.keys(PERFIS).join(', ')} (ver src/perfis/).`,
  );
}

export const perfil: Perfil = PERFIS[escolhido];

/** Título da aba do navegador — derivado, para não repetir o nome em dois lugares. */
export function tituloDoPerfil(p: Perfil = perfil): string {
  return p.organizacao ? `${p.nome} ${p.organizacao}` : p.nome;
}

/** O que a interface precisa saber (sem o conteúdo de seed). */
export function identidade(p: Perfil = perfil): {
  nome: string;
  organizacao: string;
  marca: string;
  logo: string | null;
  titulo: string;
} {
  return {
    nome: p.nome,
    organizacao: p.organizacao,
    marca: p.marca,
    logo: p.logo,
    titulo: tituloDoPerfil(p),
  };
}
