import { criarGravador, lerJson } from './arquivoJson';
import type {
  DadosNovoUsuario,
  FiltroPessoa,
  RepoAvisos,
  RepoDepartamentos,
  RepoNavegacao,
  RepoPessoas,
  RepoUsuarios,
  Repositorio,
} from './repositorio';
import { JaExiste, NaoEncontrado } from '../domain/erros';
import type { Aviso, DadosNovoAviso, PatchAviso } from '../domain/aviso';
import type { Departamento } from '../domain/departamento';
import type { DadosNovoGrupo, DadosNovoItem, GrupoComItens, GrupoMenu, ItemMenu } from '../domain/navegacao';
import { type DadosNovaPessoa, type PatchPessoa, type Pessoa, pessoaVazia } from '../domain/pessoa';
import type { Usuario } from '../domain/usuario';

interface Doc {
  pessoas: Pessoa[];
  departamentos: Departamento[];
  avisos: Aviso[];
  grupos: GrupoMenu[];
  itens: ItemMenu[];
  usuarios: Usuario[];
  seq: Record<string, number>;
}

function docVazio(): Doc {
  return { pessoas: [], departamentos: [], avisos: [], grupos: [], itens: [], usuarios: [], seq: {} };
}

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Contas gravadas antes dos campos ativo/mustChangePassword existirem:
// completa os padrões ao ler (ativa, sem troca pendente).
function normalizarUsuario(u: Usuario): Usuario {
  u.ativo = u.ativo !== false;
  u.mustChangePassword = u.mustChangePassword === true;
  return u;
}

// Repositório respaldado por um único arquivo JSON (estado em memória +
// gravação atômica). Implementa o contrato Repositorio.
export class RepositorioJson implements Repositorio {
  private doc: Doc = docVazio();
  private readonly gravar: (estado: unknown) => Promise<void>;
  private readonly caminho: string;

  constructor(caminho: string) {
    this.caminho = caminho;
    this.gravar = criarGravador(caminho);
  }

  async iniciar(): Promise<void> {
    this.doc = await lerJson<Doc>(this.caminho, docVazio());
  }

  private persistir(): Promise<void> {
    return this.gravar(this.doc);
  }

  private proximoId(colecao: string): number {
    this.doc.seq[colecao] = (this.doc.seq[colecao] ?? 0) + 1;
    return this.doc.seq[colecao];
  }

  pessoas: RepoPessoas = {
    listar: async (filtro: FiltroPessoa = {}) => {
      let itens = this.doc.pessoas;
      if (filtro.setor) itens = itens.filter((p) => p.departmentCode === filtro.setor);
      if (filtro.busca) {
        const q = normalizar(filtro.busca);
        itens = itens.filter(
          (p) =>
            normalizar(p.name).includes(q) ||
            normalizar(p.email ?? '').includes(q) ||
            normalizar(p.departmentFull ?? '').includes(q) ||
            (p.phoneExtension ?? '').includes(q),
        );
      }
      return [...itens].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    },
    todas: async () => [...this.doc.pessoas],
    obter: async (id) => this.doc.pessoas.find((p) => p.id === id),
    criar: async (dados: DadosNovaPessoa) => {
      const p: Pessoa = { ...pessoaVazia(), ...dados, id: this.proximoId('pessoas') };
      this.doc.pessoas.push(p);
      await this.persistir();
      return p;
    },
    atualizar: async (id, patch: PatchPessoa) => {
      const p = this.doc.pessoas.find((x) => x.id === id);
      if (!p) throw new NaoEncontrado('pessoa não encontrada');
      Object.assign(p, patch);
      await this.persistir();
      return p;
    },
    remover: async (id) => {
      const i = this.doc.pessoas.findIndex((x) => x.id === id);
      if (i < 0) throw new NaoEncontrado('pessoa não encontrada');
      const [p] = this.doc.pessoas.splice(i, 1);
      await this.persistir();
      return p;
    },
    definirTodas: async (lista) => {
      this.doc.pessoas = [...lista];
      this.doc.seq.pessoas = lista.reduce((m, p) => Math.max(m, p.id), 0);
      await this.persistir();
      return this.doc.pessoas.length;
    },
    contar: async () => this.doc.pessoas.length,
  };

  departamentos: RepoDepartamentos = {
    listar: async () => [...this.doc.departamentos].sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    porCodigo: async (code) => this.doc.departamentos.find((d) => d.code === code),
    upsert: async (dados) => {
      const ex = this.doc.departamentos.find((d) => d.code === dados.code);
      if (ex) {
        Object.assign(ex, dados);
        await this.persistir();
        return ex;
      }
      const d: Departamento = { id: this.proximoId('departamentos'), ...dados };
      this.doc.departamentos.push(d);
      await this.persistir();
      return d;
    },
  };

  avisos: RepoAvisos = {
    listar: async () =>
      [...this.doc.avisos].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt),
      ),
    criar: async (dados: DadosNovoAviso & { createdBy: number | null; autor: string | null }) => {
      const a: Aviso = {
        id: this.proximoId('avisos'),
        title: dados.title,
        body: dados.body,
        pinned: Boolean(dados.pinned),
        categoria: dados.categoria,
        autor: dados.autor,
        createdBy: dados.createdBy,
        createdAt: new Date().toISOString(),
      };
      this.doc.avisos.push(a);
      await this.persistir();
      return a;
    },
    atualizar: async (id, patch: PatchAviso) => {
      const a = this.doc.avisos.find((x) => x.id === id);
      if (!a) throw new NaoEncontrado('comunicado não encontrado');
      Object.assign(a, patch);
      await this.persistir();
      return a;
    },
    remover: async (id) => {
      const i = this.doc.avisos.findIndex((x) => x.id === id);
      if (i < 0) throw new NaoEncontrado('comunicado não encontrado');
      const [a] = this.doc.avisos.splice(i, 1);
      await this.persistir();
      return a;
    },
  };

  navegacao: RepoNavegacao = {
    arvore: async () => {
      const grupos = [...this.doc.grupos].sort((a, b) => a.ordem - b.ordem);
      return grupos.map<GrupoComItens>((g) => ({
        ...g,
        itens: this.doc.itens.filter((i) => i.grupoId === g.id).sort((a, b) => a.ordem - b.ordem),
      }));
    },
    criarGrupo: async (dados: DadosNovoGrupo) => {
      const g: GrupoMenu = {
        id: this.proximoId('grupos'),
        nome: dados.nome,
        url: dados.url,
        destaque: dados.destaque,
        ordem: this.doc.grupos.length + 1,
      };
      this.doc.grupos.push(g);
      await this.persistir();
      return g;
    },
    removerGrupo: async (id) => {
      const i = this.doc.grupos.findIndex((g) => g.id === id);
      if (i < 0) throw new NaoEncontrado('grupo não encontrado');
      this.doc.grupos.splice(i, 1);
      this.doc.itens = this.doc.itens.filter((it) => it.grupoId !== id); // remove itens órfãos
      await this.persistir();
    },
    reordenarGrupos: async (ids) => {
      ids.forEach((id, idx) => {
        const g = this.doc.grupos.find((x) => x.id === id);
        if (g) g.ordem = idx + 1;
      });
      await this.persistir();
    },
    criarItem: async (dados: DadosNovoItem) => {
      if (!this.doc.grupos.some((g) => g.id === dados.grupoId)) {
        throw new NaoEncontrado('grupo não encontrado');
      }
      const irmãos = this.doc.itens.filter((i) => i.grupoId === dados.grupoId);
      const item: ItemMenu = {
        id: this.proximoId('itens'),
        grupoId: dados.grupoId,
        label: dados.label,
        url: dados.url,
        descricao: dados.descricao,
        ordem: irmãos.length + 1,
      };
      this.doc.itens.push(item);
      await this.persistir();
      return item;
    },
    removerItem: async (id) => {
      const i = this.doc.itens.findIndex((x) => x.id === id);
      if (i < 0) throw new NaoEncontrado('item não encontrado');
      this.doc.itens.splice(i, 1);
      await this.persistir();
    },
    reordenarItens: async (grupoId, ids) => {
      ids.forEach((id, idx) => {
        const it = this.doc.itens.find((x) => x.id === id && x.grupoId === grupoId);
        if (it) it.ordem = idx + 1;
      });
      await this.persistir();
    },
    contarGrupos: async () => this.doc.grupos.length,
  };

  usuarios: RepoUsuarios = {
    listar: async () =>
      [...this.doc.usuarios].map(normalizarUsuario).sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    porEmail: async (email) => {
      const u = this.doc.usuarios.find((x) => x.email.toLowerCase() === email.toLowerCase());
      return u && normalizarUsuario(u);
    },
    obter: async (id) => {
      const u = this.doc.usuarios.find((x) => x.id === id);
      return u && normalizarUsuario(u);
    },
    criar: async (dados: DadosNovoUsuario) => {
      if (this.doc.usuarios.some((x) => x.email.toLowerCase() === dados.email.toLowerCase())) {
        throw new JaExiste('já existe uma conta com este e-mail');
      }
      const u: Usuario = {
        id: this.proximoId('usuarios'),
        ativo: true,
        mustChangePassword: false,
        ...dados,
      };
      this.doc.usuarios.push(u);
      await this.persistir();
      return u;
    },
    atualizar: async (id, patch) => {
      const u = this.doc.usuarios.find((x) => x.id === id);
      if (!u) throw new NaoEncontrado('conta não encontrada');
      if (patch.email && this.doc.usuarios.some((x) => x.id !== id && x.email.toLowerCase() === patch.email!.toLowerCase())) {
        throw new JaExiste('já existe uma conta com este e-mail');
      }
      Object.assign(u, patch);
      await this.persistir();
      return normalizarUsuario(u);
    },
    remover: async (id) => {
      const i = this.doc.usuarios.findIndex((x) => x.id === id);
      if (i < 0) throw new NaoEncontrado('conta não encontrada');
      const [u] = this.doc.usuarios.splice(i, 1);
      await this.persistir();
      return normalizarUsuario(u);
    },
    contar: async () => this.doc.usuarios.length,
  };
}
