import { api, clearToken, getToken, setToken } from './core/api.js';
import { aplicarFavicon, avatar, esc, ico, marcaHtml } from './core/ui.js';
import { renderSidebar } from './componentes/sidebar.js';
import { renderDashboard } from './componentes/dashboard.js';
import { renderComunicados, renderNovoComunicado } from './componentes/avisos.js';
import { renderPessoas } from './componentes/contatos.js';
import { renderAniversariantesPagina } from './componentes/aniversariantes.js';
import { abrirTrocaDeSenha, renderContas } from './componentes/contas.js';
import { renderAuditoria } from './componentes/auditoria.js';
import { renderRecurso } from './componentes/recurso.js';
import { renderPaginas } from './componentes/paginas.js';

const appEl = document.querySelector('#app');

// Identidade vem do servidor (src/perfil.ts). Os valores abaixo são só o
// fallback se a chamada falhar — a tela nunca fica sem marca.
const PERFIL_PADRAO = { nome: 'Intranet', organizacao: '', marca: 'IN', logo: null, titulo: 'Intranet' };

const state = {
  usuario: null,
  view: 'inicio',
  params: {},
  setores: [],
  perfil: PERFIL_PADRAO,
  recursos: [], // páginas criadas pela tela (recursos dirigidos por dados)
};

const isAdmin = () => state.usuario?.role === 'admin';
const isGestor = () => state.usuario?.role === 'gestor';

// Views restritas por papel; pedidas sem permissão, caem no início.
const VIEWS_GESTAO = new Set(['usuarios', 'gerenciar-comunicados', 'novo-comunicado']);
const VIEWS_ADMIN = new Set(['contas', 'auditoria', 'paginas']);

function montarCtx() {
  return {
    admin: isAdmin(),
    gestor: isGestor(),
    gestao: isAdmin() || isGestor(), // quem entra no "modo gestão" da UI
    usuario: state.usuario,
    view: state.view,
    setores: state.setores,
    perfil: state.perfil,
    recursos: state.recursos,
    buscaInicial: state.params.busca || '',
    // páginas criadas/editadas/excluídas: recarrega o menu e a view
    recarregarRecursos: async () => {
      state.recursos = await api('/recursos').catch(() => state.recursos);
      renderShell();
    },
    navegar,
    sair,
    entrar: () => renderLogin(),
    // setores mudaram (criar/renomear/excluir): recarrega a referência e a view
    recarregarSetores: async () => {
      state.setores = await api('/setores').catch(() => state.setores);
      renderShell();
    },
    trocarSenha: () =>
      abrirTrocaDeSenha({
        aoTrocar: (r) => {
          setToken(r.token);
          state.usuario = r.user;
          renderShell();
        },
      }),
    // callbacks para manter a home coerente após mutações
    aoMudarPessoas: () => {},
    aoMudarAvisos: () => {},
  };
}

function navegar(view, params = {}) {
  if (VIEWS_ADMIN.has(view) && !isAdmin()) view = 'inicio';
  if (VIEWS_GESTAO.has(view) && !isAdmin() && !isGestor()) view = 'inicio';
  state.view = view;
  state.params = params;
  renderShell();
}

function sair() {
  clearToken();
  state.usuario = null;
  state.view = 'inicio';
  state.params = {};
  renderShell();
}

function renderShell() {
  const ctx = montarCtx();
  appEl.innerHTML = `
    <div class="shell ${ctx.gestao ? 'is-admin' : ''}">
      <aside class="sidebar" id="sidebar"></aside>
      <div class="main">
        <header class="topbar" id="topbar"></header>
        <div class="view" id="view"></div>
      </div>
    </div>`;

  renderSidebar(document.getElementById('sidebar'), ctx);
  renderTopbar(document.getElementById('topbar'), ctx);
  renderView(document.getElementById('view'), ctx);
}

function renderTopbar(el, ctx) {
  el.innerHTML = `
    <div class="search">
      ${ico('search', { size: 20, color: '#8a94a0' })}
      <input id="topbusca" placeholder="Buscar pessoas, setores, ramais…  (Enter)" />
    </div>
    <div class="topbar-spacer"></div>
    ${
      ctx.gestao
        ? `<button class="icon-btn" title="Notificações">${ico('notifications', {
            size: 21,
          })}<span class="dot"></span></button>
           ${avatar(ctx.usuario?.name || 'Administrador', { size: 40 })}`
        : `<button class="icon-btn ir-ramais" title="Ramais">${ico('contacts', { size: 21 })}</button>
           <button class="btn-entrar">${ico('lock', { size: 17 })} Entrar (admin)</button>`
    }`;

  const busca = el.querySelector('#topbusca');
  busca.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && busca.value.trim()) navegar('ramais', { busca: busca.value.trim() });
  });
  el.querySelector('.btn-entrar')?.addEventListener('click', () => renderLogin());
  el.querySelector('.ir-ramais')?.addEventListener('click', () => navegar('ramais'));
}

function renderView(el, ctx) {
  // Páginas criadas pela tela: a view é "r:<chave>" e cai na tela genérica.
  if (state.view.startsWith('r:')) {
    return renderRecurso(el, ctx, { chave: state.view.slice(2) });
  }
  switch (state.view) {
    case 'paginas':
      return renderPaginas(el, ctx);
    case 'comunicados':
      return renderComunicados(el, ctx, { manage: false });
    case 'gerenciar-comunicados':
      return renderComunicados(el, ctx, { manage: true });
    case 'ramais':
      return renderPessoas(el, ctx, { manage: false });
    case 'aniversariantes':
      return renderAniversariantesPagina(el, ctx);
    case 'usuarios':
      return renderPessoas(el, ctx, { manage: true });
    case 'contas':
      return renderContas(el, ctx);
    case 'auditoria':
      return renderAuditoria(el, ctx);
    case 'novo-comunicado':
      return renderNovoComunicado(el, ctx, { editar: state.params.editar || null });
    case 'inicio':
    default:
      return renderDashboard(el, ctx);
  }
}

// ------------------------------------------------------------------ login
function renderLogin(msg = '') {
  appEl.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-brand">
          ${marcaHtml(state.perfil, 'brand-mark')}
          <div><h1>${esc(state.perfil.titulo)}</h1><p class="subtitle">Entrar como administrador</p></div>
        </div>
        <form class="login-form" id="f-login">
          <div><label>E-mail</label>
            <input name="email" autocomplete="username" placeholder="admin@intranet.local" required /></div>
          <div><label>Senha</label>
            <input name="senha" type="password" autocomplete="current-password" placeholder="••••••••" required /></div>
          ${msg ? `<p class="login-error">${esc(msg)}</p>` : ''}
          <div class="login-actions">
            <button type="submit" class="btn btn-primary">Entrar</button>
            <button type="button" class="btn btn-ghost" id="voltar">Voltar ao diretório</button>
          </div>
        </form>
      </div>
    </div>`;

  appEl.querySelector('#voltar').addEventListener('click', () => {
    state.view = 'inicio';
    renderShell();
  });
  appEl.querySelector('#f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: fd.get('email'), senha: fd.get('senha') }),
      });
      setToken(r.token);
      state.usuario = r.user;
      state.view = 'inicio';
      renderShell();
      exigirTrocaSePendente();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

// Senha inicial pendente: força a troca antes de qualquer gestão (o backend
// também bloqueia as escritas até resolver — isto aqui é a via feliz).
function exigirTrocaSePendente() {
  if (!state.usuario?.mustChangePassword) return;
  abrirTrocaDeSenha({
    forcado: true,
    aoTrocar: (r) => {
      setToken(r.token);
      state.usuario = r.user;
      renderShell();
    },
  });
}

// ------------------------------------------------------------------- boot
async function boot() {
  // Identidade primeiro: título, favicon e marca saem daqui (src/perfil.ts).
  try {
    state.perfil = { ...PERFIL_PADRAO, ...(await api('/perfil')) };
  } catch {
    state.perfil = PERFIL_PADRAO;
  }
  document.title = state.perfil.titulo;
  aplicarFavicon(state.perfil);

  if (getToken()) {
    try {
      state.usuario = await api('/auth/me');
    } catch {
      state.usuario = null;
    }
  }
  try {
    state.setores = await api('/setores');
  } catch {
    state.setores = [];
  }
  try {
    state.recursos = await api('/recursos');
  } catch {
    state.recursos = [];
  }
  renderShell();
  exigirTrocaSePendente();
}

boot();
