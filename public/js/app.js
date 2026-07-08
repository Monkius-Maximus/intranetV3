import { api, clearToken, getToken, setToken } from './core/api.js';
import { esc } from './core/dom.js';
import { renderNavbar } from './componentes/navbar.js';
import { renderAvisos } from './componentes/avisos.js';
import { renderContatos } from './componentes/contatos.js';
import { renderAniversariantes } from './componentes/aniversariantes.js';
import { renderLinks } from './componentes/links.js';

const appEl = document.querySelector('#app');
let usuario = null;
const isAdmin = () => usuario?.role === 'admin';

function layout() {
  return `
    <header class="topbar">
      <span class="brand">Intranet SEPLAG</span>
      <nav id="menus" class="menus"></nav>
      <span class="conta">${
        isAdmin()
          ? `${esc(usuario.name)} · admin <button id="logout">Sair</button>`
          : `<button id="entrar">Entrar (admin)</button>`
      }</span>
    </header>
    <main class="content">
      <section class="panel" id="sec-avisos"></section>
      <section class="panel" id="sec-contatos"></section>
      <section class="panel" id="sec-aniv"></section>
      <section class="panel" id="sec-links"></section>
    </main>`;
}

// Cada módulo da home é um componente independente que busca e desenha a si
// mesmo. app.js só monta o layout e define a ordem (espelhando o Seplagnet).
async function render() {
  const setores = await api('/setores');
  appEl.innerHTML = layout();

  const sair = () => {
    clearToken();
    usuario = null;
    render();
  };
  const secAniv = appEl.querySelector('#sec-aniv');
  const secLinks = appEl.querySelector('#sec-links');
  const ctx = {
    admin: isAdmin(),
    setores,
    sair,
    aoMudarPessoas: () => renderAniversariantes(secAniv, ctx),
    aoMudarNavegacao: () => renderLinks(secLinks, ctx),
  };

  if (isAdmin()) appEl.querySelector('#logout').addEventListener('click', sair);
  else appEl.querySelector('#entrar').addEventListener('click', renderLogin);

  await Promise.all([
    renderNavbar(appEl.querySelector('#menus'), ctx),
    renderAvisos(appEl.querySelector('#sec-avisos'), ctx),
    renderContatos(appEl.querySelector('#sec-contatos'), ctx),
    renderAniversariantes(secAniv, ctx),
    renderLinks(secLinks, ctx),
  ]);
}

function renderLogin(msg = '') {
  appEl.innerHTML = `
    <main class="card">
      <h1>Intranet SEPLAG</h1>
      <p class="subtitle">Entrar como administrador</p>
      <form id="f-login">
        <label>E-mail<input name="email" autocomplete="username" required /></label>
        <label>Senha<input name="senha" type="password" autocomplete="current-password" required /></label>
        <button type="submit">Entrar</button>
        <button type="button" id="voltar" class="secundario">Voltar ao diretório</button>
        ${msg ? `<p class="error">${esc(msg)}</p>` : ''}
      </form>
    </main>`;
  appEl.querySelector('#voltar').addEventListener('click', () => render());
  appEl.querySelector('#f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: fd.get('email'), senha: fd.get('senha') }),
      });
      setToken(r.token);
      usuario = r.user;
      await render();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

async function boot() {
  if (getToken()) {
    try {
      usuario = await api('/auth/me');
    } catch {
      usuario = null;
    }
  }
  await render();
}

boot();
