import { criarGravador, lerJson } from './arquivoJson';
import type {
  DadosNovoUsuario,
  FiltroPessoa,
  RepoAuditoria,
  RepoAvisos,
  RepoDepartamentos,
  RepoEventos,
  RepoNavegacao,
  RepoPessoas,
  RepoTiles,
  RepoUsuarios,
  Repositorio,
} from './repositorio';
import { EmUso, JaExiste, NaoEncontrado } from '../domain/erros';
import { AUDITORIA_MAXIMO, type RegistroAuditoria } from '../domain/auditoria';
import type { Anexo, Aviso, DadosNovoAviso, PatchAviso } from '../domain/aviso';
import type { DadosNovoSetor, Departamento, PatchSetor } from '../domain/departamento';
import type { DadosNovoEvento, Evento, PatchEvento } from '../domain/evento';
import type { DadosNovoGrupo, DadosNovoItem, GrupoComItens, GrupoMenu, ItemMenu } from '../domain/navegacao';
import {
  type DadosNovaPessoa,
  type PatchPessoa,
  type Pessoa,
  codigosDeCaminho,
  normalizarSetores,
  pessoaVazia,
} from '../domain/pessoa';
import type { DadosNovoTile, PatchTile, Tile } from '../domain/tile';
import type { Usuario } from '../domain/usuario';

interface Doc {
  pessoas: Pessoa[];
  departamentos: Departamento[];
  avisos: Aviso[];
  grupos: GrupoMenu[];
  itens: ItemMenu[];
  usuarios: Usuario[];
  tiles: Tile[];
  eventos: Evento[];
  auditoria: RegistroAuditoria[];
  seq: Record<string, number>;
}

function docVazio(): Doc {
  return {
    pessoas: [],
    departamentos: [],
    avisos: [],
    grupos: [],
    itens: [],
    usuarios: [],
    tiles: [],
    eventos: [],
    auditoria: [],
    seq: {},
  };
}

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// Contas gravadas antes dos campos ativo/mustChangePassword existirem:
// completa os padrões ao ler (ativa, sem troca pendente).
function normalizarUsuario(u: Usuario): Usuario {
  u.ativo = u.ativo !== false;
  u.mustChangePassword = u.mustChangePassword === true;
  u.setores ??= [];
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
    // Bancos gravados por versões anteriores não têm as coleções/campos novos.
    this.doc.tiles ??= [];
    this.doc.eventos ??= [];
    this.doc.auditoria ??= [];
    for (const a of this.doc.avisos) a.anexos ??= [];
    // Bancos anteriores ao multi-setor não têm pessoas[].setores: deriva do
    // caminho (SECOGE/NSI -> ['SECOGE','NSI']); depois só normaliza.
    for (const p of this.doc.pessoas) {
      p.setores =
        Array.isArray(p.setores) && p.setores.length > 0
          ? normalizarSetores(p)
          : codigosDeCaminho(p.departmentCode ?? null, p.departmentFull ?? null);
    }
    // Registra como setores (filtráveis) os núcleos já presentes nas pessoas mas
    // ausentes da lista de departamentos — para um banco importado ANTES do
    // multi-setor ganhar os núcleos só com o deploy, sem reimportar. O pai é a
    // secretaria principal da pessoa.
    const codigos = new Set(this.doc.departamentos.map((d) => d.code));
    let novos = 0;
    for (const p of this.doc.pessoas) {
      const principal = p.departmentCode ?? null;
      if (!principal) continue;
      for (const s of p.setores) {
        if (s !== principal && !codigos.has(s)) {
          this.doc.departamentos.push({ id: this.proximoId('departamentos'), code: s, name: s, parent: principal });
          codigos.add(s);
          novos += 1;
        }
      }
    }
    if (novos > 0) await this.persistir();
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
      if (filtro.setor) {
        const alvo = filtro.setor;
        itens = itens.filter((p) => (p.setores ?? []).includes(alvo) || p.departmentCode === alvo);
      }
      if (filtro.busca) {
        const q = normalizar(filtro.busca);
        itens = itens.filter(
          (p) =>
            normalizar(p.name).includes(q) ||
            normalizar(p.email ?? '').includes(q) ||
            normalizar(p.departmentFull ?? '').includes(q) ||
            (p.setores ?? []).some((c) => normalizar(c).includes(q)) ||
            (p.phoneExtension ?? '').includes(q),
        );
      }
      return [...itens].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    },
    todas: async () => [...this.doc.pessoas],
    obter: async (id) => this.doc.pessoas.find((p) => p.id === id),
    criar: async (dados: DadosNovaPessoa) => {
      const p: Pessoa = { ...pessoaVazia(), ...dados, id: this.proximoId('pessoas') };
      p.setores = normalizarSetores(p); // garante o principal na lista, sem repetição
      this.doc.pessoas.push(p);
      await this.persistir();
      return p;
    },
    atualizar: async (id, patch: PatchPessoa) => {
      const p = this.doc.pessoas.find((x) => x.id === id);
      if (!p) throw new NaoEncontrado('pessoa não encontrada');
      Object.assign(p, patch);
      p.setores = normalizarSetores(p); // reconcilia lista x setor principal após o patch
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
    listar: async () => [...this.doc.departamentos].sort((a, b) => a.code.localeCompare(b.code, 'pt')),
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
    criar: async (dados: DadosNovoSetor) => {
      if (this.doc.departamentos.some((d) => d.code === dados.code)) {
        throw new JaExiste('já existe um setor com esta sigla');
      }
      // Nome vazio/ausente => a própria sigla (siglas-only).
      const d: Departamento = { id: this.proximoId('departamentos'), ...dados, name: dados.name?.trim() || dados.code };
      this.doc.departamentos.push(d);
      await this.persistir();
      return d;
    },
    atualizar: async (id, patch: PatchSetor) => {
      const d = this.doc.departamentos.find((x) => x.id === id);
      if (!d) throw new NaoEncontrado('setor não encontrado');
      // Nome apagado => assume a sigla (a nova, se estiver sendo renomeada).
      if ('name' in patch && !(patch.name ?? '').trim()) {
        patch.name = patch.code ?? d.code;
      }
      if (patch.code && patch.code !== d.code) {
        if (this.doc.departamentos.some((x) => x.id !== id && x.code === patch.code)) {
          throw new JaExiste('já existe um setor com esta sigla');
        }
        // Renomear a sigla cascateia para as pessoas: o código é a chave que
        // liga pessoa→setor; sem isto, todas ficariam órfãs do filtro.
        const antiga = d.code;
        const nova = patch.code;
        for (const p of this.doc.pessoas) {
          if (p.departmentCode === antiga) {
            p.departmentCode = nova;
            if (p.departmentFull === antiga) p.departmentFull = nova;
            else if (p.departmentFull?.startsWith(`${antiga}/`)) {
              p.departmentFull = nova + p.departmentFull.slice(antiga.length);
            }
          }
          // a sigla também vive na lista de setores (inclusive como núcleo de quem
          // tem outro principal) — troca em todos, sem depender do departmentCode.
          if (Array.isArray(p.setores) && p.setores.includes(antiga)) {
            p.setores = [...new Set(p.setores.map((s) => (s === antiga ? nova : s)))];
          }
        }
        // núcleos que apontavam para a sigla antiga como mãe seguem a renomeação.
        for (const dep of this.doc.departamentos) {
          if (dep.parent === antiga) dep.parent = nova;
        }
      }
      Object.assign(d, patch);
      await this.persistir();
      return d;
    },
    remover: async (id) => {
      const i = this.doc.departamentos.findIndex((x) => x.id === id);
      if (i < 0) throw new NaoEncontrado('setor não encontrado');
      const code = this.doc.departamentos[i].code;
      const emUso = this.doc.pessoas.filter(
        (p) => (p.setores ?? []).includes(code) || p.departmentCode === code,
      ).length;
      if (emUso > 0) {
        throw new EmUso(`o setor ${code} tem ${emUso} pessoa(s) — mova-as antes de excluir`);
      }
      this.doc.departamentos.splice(i, 1);
      await this.persistir();
    },
    contar: async () => this.doc.departamentos.length,
  };

  tiles: RepoTiles = {
    listar: async () => [...this.doc.tiles].sort((a, b) => a.ordem - b.ordem),
    criar: async (dados: DadosNovoTile) => {
      const t: Tile = { id: this.proximoId('tiles'), ordem: this.doc.tiles.length + 1, ...dados };
      this.doc.tiles.push(t);
      await this.persistir();
      return t;
    },
    atualizar: async (id, patch: PatchTile) => {
      const t = this.doc.tiles.find((x) => x.id === id);
      if (!t) throw new NaoEncontrado('tile não encontrado');
      Object.assign(t, patch);
      await this.persistir();
      return t;
    },
    remover: async (id) => {
      const i = this.doc.tiles.findIndex((x) => x.id === id);
      if (i < 0) throw new NaoEncontrado('tile não encontrado');
      this.doc.tiles.splice(i, 1);
      await this.persistir();
    },
    reordenar: async (ids) => {
      ids.forEach((id, idx) => {
        const t = this.doc.tiles.find((x) => x.id === id);
        if (t) t.ordem = idx + 1;
      });
      await this.persistir();
    },
    contar: async () => this.doc.tiles.length,
  };

  eventos: RepoEventos = {
    listar: async () =>
      [...this.doc.eventos].sort((a, b) => a.data.localeCompare(b.data) || (a.hora ?? '').localeCompare(b.hora ?? '')),
    criar: async (dados: DadosNovoEvento) => {
      const e: Evento = { id: this.proximoId('eventos'), ...dados };
      this.doc.eventos.push(e);
      await this.persistir();
      return e;
    },
    atualizar: async (id, patch: PatchEvento) => {
      const e = this.doc.eventos.find((x) => x.id === id);
      if (!e) throw new NaoEncontrado('evento não encontrado');
      Object.assign(e, patch);
      await this.persistir();
      return e;
    },
    remover: async (id) => {
      const i = this.doc.eventos.findIndex((x) => x.id === id);
      if (i < 0) throw new NaoEncontrado('evento não encontrado');
      this.doc.eventos.splice(i, 1);
      await this.persistir();
    },
  };

  avisos: RepoAvisos = {
    listar: async () =>
      [...this.doc.avisos].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt),
      ),
    obter: async (id) => this.doc.avisos.find((x) => x.id === id),
    criar: async (dados: DadosNovoAviso & { createdBy: number | null; autor: string | null }) => {
      const a: Aviso = {
        id: this.proximoId('avisos'),
        title: dados.title,
        body: dados.body,
        pinned: Boolean(dados.pinned),
        categoria: dados.categoria,
        autor: dados.autor,
        anexos: [],
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
    adicionarAnexo: async (avisoId, anexo: Omit<Anexo, 'id'>) => {
      const a = this.doc.avisos.find((x) => x.id === avisoId);
      if (!a) throw new NaoEncontrado('comunicado não encontrado');
      a.anexos.push({ id: this.proximoId('anexos'), ...anexo });
      await this.persistir();
      return a;
    },
    removerAnexo: async (avisoId, anexoId) => {
      const a = this.doc.avisos.find((x) => x.id === avisoId);
      if (!a) throw new NaoEncontrado('comunicado não encontrado');
      const i = a.anexos.findIndex((x) => x.id === anexoId);
      if (i < 0) throw new NaoEncontrado('anexo não encontrado');
      const [anexo] = a.anexos.splice(i, 1);
      await this.persistir();
      return anexo;
    },
  };

  auditoria: RepoAuditoria = {
    registrar: async (reg) => {
      this.doc.auditoria.push({
        id: this.proximoId('auditoria'),
        quando: new Date().toISOString(),
        ...reg,
      });
      if (this.doc.auditoria.length > AUDITORIA_MAXIMO) {
        this.doc.auditoria.splice(0, this.doc.auditoria.length - AUDITORIA_MAXIMO);
      }
      await this.persistir();
    },
    listar: async (limite = 200) => [...this.doc.auditoria].reverse().slice(0, limite),
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
        setores: [],
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
