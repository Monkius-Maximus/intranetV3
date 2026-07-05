const TOKEN_KEY = 'intranet_token';
const app = document.querySelector('#app');

let estado = { user: null, departments: [] };

// ------------------------------------------------------------------ helpers
const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);
const isAdmin = () => estado.user?.role === 'admin';

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
    // Só ações de admin exigem token; se expirou, volta ao modo público.
    clearToken();
    estado.user = null;
    renderLogin('Sessão expirada. Entre novamente.');
    throw new Error('não autenticado');
  }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.erro || `erro ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// -------------------------------------------------------------- login (admin)
function renderLogin(msg = '') {
  app.innerHTML = `
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
  document.querySelector('#voltar').addEventListener('click', () => render());
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
      await render();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

// ---------------------------------------------------------------- render app
async function render() {
  estado.departments = await api('/departments');
  app.innerHTML = `
    <header class="topbar">
      <span class="brand">Intranet SEPLAG</span>
      <span>${
        isAdmin()
          ? `${esc(estado.user.name)} · admin <button id="logout">Sair</button>`
          : `<button id="entrar">Entrar (admin)</button>`
      }</span>
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

  if (isAdmin()) {
    document.querySelector('#logout').addEventListener('click', () => {
      clearToken();
      estado.user = null;
      render();
    });
    ligarFormularios();
  } else {
    document.querySelector('#entrar').addEventListener('click', () => renderLogin());
  }
  document.querySelector('#busca').addEventListener('input', debounce(carregarFuncionarios, 250));
  document.querySelector('#dep').addEventListener('change', carregarFuncionarios);

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
            (e) => `<tr data-id="${e.id}">
              <td>${esc(e.name)}</td>
              <td>${esc(e.departmentFull || e.departmentCode || '')}</td>
              <td>${esc(e.phoneExtension || '')}</td>
              <td>${esc(e.email || '')}</td>
              <td>${e.birthDay && e.birthMonth ? `${e.birthDay}/${e.birthMonth}` : ''}</td>
              ${isAdmin() ? `<td class="acoes"><button class="link edit-func" data-id="${e.id}">editar</button> <button class="link del-func" data-id="${e.id}">remover</button></td>` : ''}
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
    el.querySelectorAll('.edit-func').forEach((b) =>
      b.addEventListener('click', () => {
        const emp = itens.find((x) => x.id === Number(b.dataset.id));
        if (emp) editarLinha(emp);
      }),
    );
  }
}

// Troca a linha da tabela por inputs; salvar faz PUT e recarrega a lista.
function editarLinha(emp) {
  const tr = document.querySelector(`#funcionarios tr[data-id="${emp.id}"]`);
  if (!tr) return;
  tr.innerHTML = `
    <td><input name="name" required /></td>
    <td><select name="departmentCode">
      <option value="">Setor…</option>
      ${estado.departments.map((d) => `<option value="${esc(d.code)}">${esc(d.code)}</option>`).join('')}
    </select></td>
    <td><input name="phoneExtension" class="curto" /></td>
    <td><input name="email" /></td>
    <td class="aniv"><input name="birthDay" type="number" min="1" max="31" class="curto" placeholder="Dia" />
        <input name="birthMonth" type="number" min="1" max="12" class="curto" placeholder="Mês" /></td>
    <td class="acoes"><button class="link salvar">salvar</button> <button class="link cancelar">cancelar</button></td>`;

  // Preenche via .value (evita escapar aspas em atributos HTML).
  tr.querySelector('[name=name]').value = emp.name;
  tr.querySelector('[name=departmentCode]').value = emp.departmentCode || '';
  tr.querySelector('[name=phoneExtension]').value = emp.phoneExtension || '';
  tr.querySelector('[name=email]').value = emp.email || '';
  tr.querySelector('[name=birthDay]').value = emp.birthDay ?? '';
  tr.querySelector('[name=birthMonth]').value = emp.birthMonth ?? '';

  tr.querySelector('.cancelar').addEventListener('click', () => carregarFuncionarios());
  tr.querySelector('.salvar').addEventListener('click', async () => {
    const v = (n) => tr.querySelector(`[name=${n}]`).value.trim();
    const num = (n) => (v(n) ? Number(v(n)) : null);
    const patch = {
      name: v('name'),
      email: v('email') || null,
      phoneExtension: v('phoneExtension') || null,
      birthDay: num('birthDay'),
      birthMonth: num('birthMonth'),
    };
    // Só mexe no setor se o código mudou — preserva o detalhe (ex.:
    // "SEPO/ORCAMENTO" em departmentFull) quando o admin edita outro campo.
    const codigo = v('departmentCode') || null;
    if (codigo !== (emp.departmentCode || null)) {
      patch.departmentCode = codigo;
      patch.departmentFull = codigo;
    }
    try {
      await api(`/employees/${emp.id}`, { method: 'PUT', body: JSON.stringify(patch) });
      await carregarFuncionarios();
    } catch (err) {
      alert(`Não foi possível salvar: ${err.message}`);
    }
  });
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
async function boot() {
  // Se há um token guardado, confirma se ainda é um admin válido.
  if (getToken()) {
    try {
      estado.user = await api('/me');
    } catch {
      estado.user = null;
    }
  }
  await render();
}

boot();
