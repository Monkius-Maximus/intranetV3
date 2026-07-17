import type { RegistroAuditoria } from '../domain/auditoria';
import type { Anexo, Aviso, DadosNovoAviso, PatchAviso } from '../domain/aviso';
import type { DadosNovoSetor, Departamento, PatchSetor } from '../domain/departamento';
import type { DadosNovoEvento, Evento, PatchEvento } from '../domain/evento';
import type { DadosNovoGrupo, DadosNovoItem, GrupoComItens, GrupoMenu, ItemMenu } from '../domain/navegacao';
import type { DadosNovaPessoa, PatchPessoa, Pessoa } from '../domain/pessoa';
import type { DadosNovoTile, PatchTile, Tile } from '../domain/tile';
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
  criar(dados: DadosNovoSetor): Promise<Departamento>;
  // Renomear a sigla cascateia para as pessoas do setor (departmentCode/Full).
  atualizar(id: number, patch: PatchSetor): Promise<Departamento>;
  // Remoção bloqueada (EmUso) enquanto houver pessoa no setor.
  remover(id: number): Promise<void>;
  contar(): Promise<number>;
}

export interface RepoTiles {
  listar(): Promise<Tile[]>;
  criar(dados: DadosNovoTile): Promise<Tile>;
  atualizar(id: number, patch: PatchTile): Promise<Tile>;
  remover(id: number): Promise<void>;
  reordenar(ids: number[]): Promise<void>;
  contar(): Promise<number>;
}

export interface RepoEventos {
  listar(): Promise<Evento[]>;
  criar(dados: DadosNovoEvento): Promise<Evento>;
  atualizar(id: number, patch: PatchEvento): Promise<Evento>;
  remover(id: number): Promise<void>;
}

export interface RepoAvisos {
  listar(): Promise<Aviso[]>;
  obter(id: number): Promise<Aviso | undefined>;
  criar(dados: DadosNovoAviso & { createdBy: number | null; autor: string | null }): Promise<Aviso>;
  atualizar(id: number, patch: PatchAviso): Promise<Aviso>;
  remover(id: number): Promise<Aviso>;
  adicionarAnexo(avisoId: number, anexo: Omit<Anexo, 'id'>): Promise<Aviso>;
  removerAnexo(avisoId: number, anexoId: number): Promise<Anexo>;
}

export interface RepoAuditoria {
  registrar(reg: Omit<RegistroAuditoria, 'id' | 'quando'>): Promise<void>;
  listar(limite?: number): Promise<RegistroAuditoria[]>;
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

// Criação de conta: ativo/mustChangePassword/setores têm padrão.
export type DadosNovoUsuario = Omit<Usuario, 'id' | 'ativo' | 'mustChangePassword' | 'setores'> &
  Partial<Pick<Usuario, 'ativo' | 'mustChangePassword' | 'setores'>>;

export interface RepoUsuarios {
  listar(): Promise<Usuario[]>;
  porEmail(email: string): Promise<Usuario | undefined>;
  obter(id: number): Promise<Usuario | undefined>;
  criar(dados: DadosNovoUsuario): Promise<Usuario>;
  atualizar(id: number, patch: Partial<Omit<Usuario, 'id'>>): Promise<Usuario>;
  remover(id: number): Promise<Usuario>;
  contar(): Promise<number>;
}

export interface Repositorio {
  iniciar(): Promise<void>;
  pessoas: RepoPessoas;
  departamentos: RepoDepartamentos;
  avisos: RepoAvisos;
  navegacao: RepoNavegacao;
  usuarios: RepoUsuarios;
  tiles: RepoTiles;
  eventos: RepoEventos;
  auditoria: RepoAuditoria;
}
