const TOKEN_KEY = 'intranet_token';
const app = document.querySelector('#app');

let estado = { user: null, departments: [] };

// ------------------------------------------------------------------ helpers
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
function esc(v) {
  const d = document.createElement('div');
  d.textContent = v == null ? '' : String(v);
  return d.innerHTML;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    renderLogin('Sessão expirada. Entre novamente.');
    throw new Error('não autenticado');
  }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.erro || `erro ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

const isAdmin = () => estado.user?.role === 'admin';

// -------------------------------------------------------------------- login
function renderLogin(msg = '') {
  app.innerHTML = `
    <main class="card">
      <h1>Intranet SEPLAG</h1>
      <p class="subtitle">Acesso restrito</p>
      <form id="f-login">
        <label>E-mail<input name="email" autocomplete="username" required /></label>
        <label>Senha<input name="senha" type="password" autocomplete="current-password" required /></label>
        <button type="submit">Entrar</button>
        ${msg ? `<p class="error">${esc(msg)}</p>` : ''}
      </form>
    </main>`;
  document.querySelector('#f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ email: fd.get('email'), senha: fd.get('senha') }),
      });
      setToken(r.token);
      estado.user = r.user;
      await renderApp();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

// ------------------------------------------------------------------- app
async function renderApp() {
  estado.user = await api('/me');
  estado.departments = await api('/departments');
  app.innerHTML = `
    <header class="topbar">
      <span class="brand">Intranet SEPLAG</span>
      <span>${esc(estado.user.name)} · ${esc(estado.user.role)}
        <button id="logout">Sair</button></span>
    </header>
    <main class="content">
      <section class="panel">
        <h2>Comunicados</h2>
        <div id="avisos"></div>
        ${isAdmin() ? formAviso() : ''}
      </section>

      <section class="panel">
        <div class="row">
          <h2>Ramais / Funcionários</h2>
          <div class="filtros">
            <input id="busca" placeholder="Buscar nome, e-mail, setor, ramal…" />
            <select id="dep">
              <option value="">Todos os setores</option>
              ${estado.departments.map((d) => `<option value="${esc(d.code)}">${esc(d.code)}</option>`).join('')}
            </select>
          </div>
        </div>
        ${isAdmin() ? formFuncionario() : ''}
        <div id="funcionarios">carregando…</div>
      </section>

      <section class="panel">
        <h2>Links úteis</h2>
        <div id="links"></div>
      </section>
    </main>`;

  document.querySelector('#logout').addEventListener('click', () => {
    clearToken();
    estado.user = null;
    renderLogin();
  });
  document.querySelector('#busca').addEventListener('input', debounce(carregarFuncionarios, 250));
  document.querySelector('#dep').addEventListener('change', carregarFuncionarios);
  if (isAdmin()) ligarFormularios();

  await Promise.all([carregarFuncionarios(), carregarAvisos(), carregarLinks()]);
}

// ------------------------------------------------------------- funcionários
async function carregarFuncionarios() {
  const busca = document.querySelector('#busca')?.value.trim() ?? '';
  const dep = document.querySelector('#dep')?.value ?? '';
  const qs = new URLSearchParams();
  if (busca) qs.set('busca', busca);
  if (dep) qs.set('departamento', dep);
  const itens = await api(`/employees?${qs.toString()}`);
  const el = document.querySelector('#funcionarios');
  if (itens.length === 0) {
    el.innerHTML = '<p class="vazio">Nenhum funcionário encontrado.</p>';
    return;
  }
  el.innerHTML = `
    <table>
      <thead><tr><th>Nome</th><th>Setor</th><th>Ramal</th><th>E-mail</th><th>Aniversário</th>${isAdmin() ? '<th></th>' : ''}</tr></thead>
      <tbody>
        ${itens
          .map(
            (e) => `<tr>
              <td>${esc(e.name)}</td>
              <td>${esc(e.departmentFull || e.departmentCode || '')}</td>
              <td>${esc(e.phoneExtension || '')}</td>
              <td>${esc(e.email || '')}</td>
              <td>${e.birthDay && e.birthMonth ? `${e.birthDay}/${e.birthMonth}` : ''}</td>
              ${isAdmin() ? `<td><button class="link del-func" data-id="${e.id}">remover</button></td>` : ''}
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>
    <p class="contagem">${itens.length} registro(s)</p>`;
  if (isAdmin()) {
    el.querySelectorAll('.del-func').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Remover este funcionário?')) return;
        await api(`/employees/${b.dataset.id}`, { method: 'DELETE' });
        await carregarFuncionarios();
      }),
    );
  }
}

function formFuncionario() {
  return `
    <form id="f-func" class="form-inline">
      <input name="name" placeholder="Nome" required />
      <input name="email" placeholder="E-mail" />
      <input name="phoneExtension" placeholder="Ramal" />
      <select name="departmentCode">
        <option value="">Setor…</option>
        ${estado.departments.map((d) => `<option value="${esc(d.code)}">${esc(d.code)}</option>`).join('')}
      </select>
      <input name="birthDay" type="number" min="1" max="31" placeholder="Dia" />
      <input name="birthMonth" type="number" min="1" max="12" placeholder="Mês" />
      <button type="submit">Adicionar</button>
    </form>`;
}

// -------------------------------------------------------------------- avisos
async function carregarAvisos() {
  const itens = await api('/announcements');
  const el = document.querySelector('#avisos');
  el.innerHTML =
    itens.length === 0
      ? '<p class="vazio">Nenhum comunicado.</p>'
      : itens
          .map(
            (a) => `<article class="aviso">
              <h3>${a.pinned ? '📌 ' : ''}${esc(a.title)}</h3>
              <p>${esc(a.body)}</p>
              ${isAdmin() ? `<button class="link del-aviso" data-id="${a.id}">remover</button>` : ''}
            </article>`,
          )
          .join('');
  if (isAdmin()) {
    el.querySelectorAll('.del-aviso').forEach((b) =>
      b.addEventListener('click', async () => {
        await api(`/announcements/${b.dataset.id}`, { method: 'DELETE' });
        await carregarAvisos();
      }),
    );
  }
}

function formAviso() {
  return `
    <form id="f-aviso" class="form-inline">
      <input name="title" placeholder="Título" required />
      <input name="body" placeholder="Mensagem" required />
      <label class="chk"><input name="pinned" type="checkbox" /> fixar</label>
      <button type="submit">Publicar</button>
    </form>`;
}

// --------------------------------------------------------------------- links
async function carregarLinks() {
  const itens = await api('/links');
  document.querySelector('#links').innerHTML = itens
    .map(
      (l) => `<a class="link-card" href="${esc(l.url)}" target="_blank" rel="noopener">
        <strong>${esc(l.title)}</strong><span>${esc(l.description || '')}</span></a>`,
    )
    .join('');
}

// ---------------------------------------------------------------- admin forms
function ligarFormularios() {
  document.querySelector('#f-func')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const num = (v) => (v ? Number(v) : null);
    await api('/employees', {
      method: 'POST',
      body: JSON.stringify({
        name: fd.get('name'),
        email: fd.get('email') || null,
        phoneExtension: fd.get('phoneExtension') || null,
        departmentCode: fd.get('departmentCode') || null,
        departmentFull: fd.get('departmentCode') || null,
        birthDay: num(fd.get('birthDay')),
        birthMonth: num(fd.get('birthMonth')),
      }),
    });
    e.target.reset();
    await carregarFuncionarios();
  });

  document.querySelector('#f-aviso')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/announcements', {
      method: 'POST',
      body: JSON.stringify({ title: fd.get('title'), body: fd.get('body'), pinned: fd.get('pinned') === 'on' }),
    });
    e.target.reset();
    await carregarAvisos();
  });
}

// ------------------------------------------------------------------- utils
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// --------------------------------------------------------------------- boot
if (getToken()) {
  renderApp().catch(() => renderLogin());
} else {
  renderLogin();
}
