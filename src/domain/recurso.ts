import { z } from 'zod';
import { ICONES_TILE } from './tile';

// ===========================================================================
// RECURSOS DIRIGIDOS POR DADOS — o "CRUD de página".
//
// Um recurso é uma lista que o admin cria PELA TELA (Estoque, Gastos, Tarefas)
// sem ninguém programar: a definição dos campos fica no próprio banco, a API
// atende em /api/r/:chave e a interface monta tabela e formulário a partir da
// definição.
//
// Isto NÃO substitui os recursos escritos à mão (Pessoas, Comunicados): estes
// têm regras próprias (cascata de setor, anexos, aniversariantes). Recursos
// dirigidos por dados cobrem as listas simples — que são a maioria.
// ===========================================================================

export const TIPOS_CAMPO = ['texto', 'numero', 'data', 'booleano', 'selecao'] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const ROTULO_TIPO: Record<TipoCampo, string> = {
  texto: 'Texto',
  numero: 'Número',
  data: 'Data',
  booleano: 'Sim/Não',
  selecao: 'Seleção',
};

export interface CampoRecurso {
  chave: string; // identificador do campo dentro do registro (ex.: 'quantidade')
  rotulo: string; // como aparece na tela (ex.: 'Quantidade')
  tipo: TipoCampo;
  obrigatorio: boolean;
  opcoes: string[]; // só para 'selecao'
}

export interface Recurso {
  id: number;
  chave: string; // slug: vira /api/r/<chave> e a rota #r-<chave> na interface
  nome: string; // rótulo do menu (ex.: 'Estoque')
  icone: string; // ícone do menu (do subconjunto embarcado da fonte)
  ordem: number;
  campos: CampoRecurso[];
}

export interface Registro {
  id: number;
  recurso: string; // chave do recurso a que pertence
  valores: Record<string, string | number | boolean | null>;
  criadoEm: string;
  atualizadoEm: string | null;
}

// --------------------------------------------------------------- validação
// Identificador técnico: minúsculas, números e hífen/sublinhado. É usado em URL
// e como chave de objeto, por isso não aceita espaço nem acento.
const identificador = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(/^[a-z][a-z0-9_-]*$/, 'use minúsculas, números, hífen ou sublinhado (começando por letra)');

// 'id' é da estrutura, não do conteúdo — bloquear evita registro com dois ids.
const CHAVES_RESERVADAS = new Set(['id', 'recurso', 'criadoem', 'atualizadoem']);

export const campoSchema = z
  .object({
    chave: identificador,
    rotulo: z.string().trim().min(1).max(60),
    tipo: z.enum(TIPOS_CAMPO),
    obrigatorio: z.boolean().default(false),
    opcoes: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  })
  .refine((c) => !CHAVES_RESERVADAS.has(c.chave.toLowerCase()), {
    message: 'esta chave é reservada pelo sistema',
    path: ['chave'],
  })
  .refine((c) => c.tipo !== 'selecao' || c.opcoes.length > 0, {
    message: 'um campo de seleção precisa de pelo menos uma opção',
    path: ['opcoes'],
  });

const campos = z
  .array(campoSchema)
  .min(1, 'defina pelo menos um campo')
  .max(30)
  .refine((cs) => new Set(cs.map((c) => c.chave)).size === cs.length, {
    message: 'há campos com a mesma chave',
  });

export const criarRecursoSchema = z.object({
  chave: identificador,
  nome: z.string().trim().min(1).max(40),
  icone: z.enum(ICONES_TILE).default('folder_open'),
  campos,
});

// Atualização: a CHAVE não muda (é a identidade dos registros já gravados).
export const atualizarRecursoSchema = z
  .object({
    nome: z.string().trim().min(1).max(40),
    icone: z.enum(ICONES_TILE),
    campos,
  })
  .partial();

export type DadosNovoRecurso = z.infer<typeof criarRecursoSchema>;
export type PatchRecurso = z.infer<typeof atualizarRecursoSchema>;

// ------------------------------------------------- validação dos REGISTROS
// O schema de um registro NÃO existe no código: é montado a partir da
// definição que o admin criou pela tela.
function schemaDoCampo(c: CampoRecurso): z.ZodTypeAny {
  switch (c.tipo) {
    case 'numero':
      return z.coerce.number().finite();
    case 'data':
      return z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD');
    case 'booleano':
      return z.boolean();
    case 'selecao':
      return z.enum(c.opcoes as [string, ...string[]]);
    case 'texto':
    default:
      return z.string().trim().max(500);
  }
}

/** Campo vazio (string em branco / ausente) conta como não preenchido. */
function vazio(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

export function schemaDeRegistro(recurso: Recurso): z.ZodType<Record<string, unknown>> {
  const forma: Record<string, z.ZodTypeAny> = {};
  for (const c of recurso.campos) {
    const base = schemaDoCampo(c);
    if (c.obrigatorio) {
      forma[c.chave] = c.tipo === 'texto' ? z.string().trim().min(1, 'campo obrigatório').max(500) : base;
    } else {
      // Opcional: aceita ausente/vazio e grava null — sem obrigar o cliente a
      // omitir a chave.
      forma[c.chave] = z.preprocess((v) => (vazio(v) ? null : v), base.nullable());
    }
  }
  // strict: chave desconhecida é erro (pega campo renomeado/errado no cliente).
  return z.object(forma).strict() as unknown as z.ZodType<Record<string, unknown>>;
}

/** Só os campos definidos, na ordem da definição — o que a tabela mostra. */
export function valoresParaLinha(recurso: Recurso, reg: Registro): (string | number | boolean | null)[] {
  return recurso.campos.map((c) => reg.valores[c.chave] ?? null);
}
