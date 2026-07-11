import type { Aviso, DadosNovoAviso, PatchAviso } from '../domain/aviso';
import type { Departamento } from '../domain/departamento';
import type { DadosNovoGrupo, DadosNovoItem, GrupoComItens, GrupoMenu, ItemMenu } from '../domain/navegacao';
import type { DadosNovaPessoa, PatchPessoa, Pessoa } from '../domain/pessoa';
import type { Usuario } from '../domain/usuario';

// Contrato de persistência. A aplicação (http/, ingest, seed) depende SÓ desta
// interface — trocar JSON por SQLite/Postgres/uma API é escrever outra
// implementação, sem tocar em rotas, domínio ou UI.

export interface FiltroPessoa {
  busca?: string;
  setor?: string;
}

export interface RepoPessoas {
  listar(filtro?: FiltroPessoa): Promise<Pessoa[]>;
  todas(): Promise<Pessoa[]>;
  obter(id: number): Promise<Pessoa | undefined>;
  criar(dados: DadosNovaPessoa): Promise<Pessoa>;
  atualizar(id: number, patch: PatchPessoa): Promise<Pessoa>;
  remover(id: number): Promise<Pessoa>;
  // Substitui o quadro inteiro por uma lista já mesclada, com ids (usado pelo
  // ingest — ids preservados para vínculos futuros, ex.: Synergy+).
  definirTodas(lista: Pessoa[]): Promise<number>;
  contar(): Promise<number>;
}

export interface RepoDepartamentos {
  listar(): Promise<Departamento[]>;
  porCodigo(code: string): Promise<Departamento | undefined>;
  upsert(dados: Omit<Departamento, 'id'>): Promise<Departamento>;
}

export interface RepoAvisos {
  listar(): Promise<Aviso[]>;
  criar(dados: DadosNovoAviso & { createdBy: number | null; autor: string | null }): Promise<Aviso>;
  atualizar(id: number, patch: PatchAviso): Promise<Aviso>;
  remover(id: number): Promise<Aviso>;
}

export interface RepoNavegacao {
  arvore(): Promise<GrupoComItens[]>;
  criarGrupo(dados: DadosNovoGrupo): Promise<GrupoMenu>;
  removerGrupo(id: number): Promise<void>;
  reordenarGrupos(ids: number[]): Promise<void>;
  criarItem(dados: DadosNovoItem): Promise<ItemMenu>;
  removerItem(id: number): Promise<void>;
  reordenarItens(grupoId: number, ids: number[]): Promise<void>;
  contarGrupos(): Promise<number>;
}

export interface RepoUsuarios {
  porEmail(email: string): Promise<Usuario | undefined>;
  obter(id: number): Promise<Usuario | undefined>;
  criar(dados: Omit<Usuario, 'id'>): Promise<Usuario>;
  contar(): Promise<number>;
}

export interface Repositorio {
  iniciar(): Promise<void>;
  pessoas: RepoPessoas;
  departamentos: RepoDepartamentos;
  avisos: RepoAvisos;
  navegacao: RepoNavegacao;
  usuarios: RepoUsuarios;
}
