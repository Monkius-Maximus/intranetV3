import { z } from 'zod';

// Modelo de Pessoa preparado para crescer. Dividido em dois blocos por
// PROCEDÊNCIA — quem é dono de cada campo (ver src/ingest.ts):
//
//   NÚCLEO         — vem das importações (aniversariantes/RH). Um reimport
//                    atualiza estes campos.
//   ENRIQUECIMENTO — vem do admin / futuro Synergy+. Um reimport NUNCA os toca.

export interface RedesSociais {
  linkedin?: string;
  github?: string;
  instagram?: string;
  site?: string;
}

export interface PeriodoAtuacao {
  inicio?: string; // ano ou data (ex.: "2019" ou "2019-03")
  fim?: string;
}

export type StatusPessoa = 'ativo' | 'ex';

export interface Pessoa {
  id: number;

  // núcleo
  name: string;
  departmentCode: string | null;
  departmentFull: string | null;
  birthDay: number | null;
  birthMonth: number | null;

  // enriquecimento (opcional — preenchido depois)
  email: string | null;
  phoneExtension: string | null;
  cargo: string | null;
  redes: RedesSociais;
  competencias: string[];
  atuacao: PeriodoAtuacao | null;
  status: StatusPessoa;

  // metadados
  fonte: string | null; // última origem que escreveu o núcleo (ex.: "xlsx-aniversariantes")
}

// Campos que as IMPORTAÇÕES governam. Tudo fora desta lista é enriquecimento e
// é preservado em reimportações.
export const CAMPOS_NUCLEO = ['name', 'departmentCode', 'departmentFull', 'birthDay', 'birthMonth'] as const;

// Registro normalizado que qualquer origem (XLSX, SQL, API, Forms) produz.
export interface PessoaImportada {
  name: string;
  departmentCode: string | null;
  departmentFull: string | null;
  birthDay: number | null;
  birthMonth: number | null;
}

export function pessoaVazia(): Omit<Pessoa, 'id'> {
  return {
    name: '',
    departmentCode: null,
    departmentFull: null,
    birthDay: null,
    birthMonth: null,
    email: null,
    phoneExtension: null,
    cargo: null,
    redes: {},
    competencias: [],
    atuacao: null,
    status: 'ativo',
    fonte: null,
  };
}

// Chave de casamento para reimportações. Nome não é perfeito (homônimos); quando
// o e-mail existir, ele passa a ser a melhor chave — ver comentário no ingest.
export function chaveDePessoa(p: { name: string }): string {
  return p.name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// ----------------------------------------------------------------- validação
const redesSchema = z
  .object({
    linkedin: z.string().trim().max(300).optional(),
    github: z.string().trim().max(300).optional(),
    instagram: z.string().trim().max(300).optional(),
    site: z.string().trim().max(300).optional(),
  })
  .strict();

const atuacaoSchema = z
  .object({
    inicio: z.string().trim().max(20).optional(),
    fim: z.string().trim().max(20).optional(),
  })
  .strict()
  .nullable();

// Núcleo + enriquecimento, todos os campos de enriquecimento opcionais.
const base = {
  name: z.string().trim().min(1).max(255),
  departmentCode: z.string().trim().max(50).nullable(),
  departmentFull: z.string().trim().max(255).nullable(),
  birthDay: z.number().int().min(1).max(31).nullable(),
  birthMonth: z.number().int().min(1).max(12).nullable(),
  email: z.string().trim().max(255).nullable(),
  phoneExtension: z.string().trim().max(20).nullable(),
  cargo: z.string().trim().max(120).nullable(),
  redes: redesSchema,
  competencias: z.array(z.string().trim().min(1).max(60)).max(50),
  atuacao: atuacaoSchema,
  status: z.enum(['ativo', 'ex']),
};

// Criação: name obrigatório; o resto assume o padrão de pessoaVazia se ausente.
export const criarPessoaSchema = z.object({
  name: base.name,
  departmentCode: base.departmentCode.default(null),
  departmentFull: base.departmentFull.default(null),
  birthDay: base.birthDay.default(null),
  birthMonth: base.birthMonth.default(null),
  email: base.email.default(null),
  phoneExtension: base.phoneExtension.default(null),
  cargo: base.cargo.default(null),
  redes: base.redes.default({}),
  competencias: base.competencias.default([]),
  atuacao: base.atuacao.default(null),
  status: base.status.default('ativo'),
});

// Atualização parcial: só o que vier é alterado (SEM defaults — senão um PATCH
// apagaria campos não enviados).
export const atualizarPessoaSchema = z.object(base).partial();

export type DadosNovaPessoa = z.infer<typeof criarPessoaSchema>;
export type PatchPessoa = z.infer<typeof atualizarPessoaSchema>;
