import './style.css';
import {
  Announcement,
  User,
  clearToken,
  fetchAnnouncements,
  fetchMe,
  fetchUsers,
  getToken,
  login,
  setToken,
} from './api';

const app = document.querySelector<HTMLDivElement>('#app')!;

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function renderLogin(message = ''): void {
  app.innerHTML = `
    <main class="card">
      <h1>Intranet SEPLAG</h1>
      <p class="subtitle">Acesso restrito</p>
      <form id="login-form">
        <label>Usuário<input name="username" autocomplete="username" required /></label>
        <label>Senha<input name="password" type="password" autocomplete="current-password" required /></label>
        <button type="submit">Entrar</button>
        ${message ? `<p class="error">${escapeHtml(message)}</p>` : ''}
      </form>
    </main>`;

  const form = document.querySelector<HTMLFormElement>('#login-form')!;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const result = await login(
        String(data.get('username')),
        String(data.get('password')),
      );
      setToken(result.token);
      await renderDashboard();
    } catch (error) {
      renderLogin(error instanceof Error ? error.message : 'Falha no login');
    }
  });
}

function renderAnnouncements(announcements: Announcement[]): string {
  if (announcements.length === 0) {
    return '<p>Nenhum comunicado publicado.</p>';
  }
  return announcements
    .map(
      (item) => `
      <article class="announcement">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
        <small>${item.author ? escapeHtml(item.author) : 'Sistema'}</small>
      </article>`,
    )
    .join('');
}

function renderUserTable(users: User[]): string {
  const rows = users
    .map(
      (user) => `
      <tr>
        <td>${escapeHtml(user.username)}</td>
        <td>${escapeHtml(user.fullName)}</td>
        <td>${escapeHtml(user.role)}</td>
      </tr>`,
    )
    .join('');
  return `
    <section class="admin">
      <h2>Usuários (visão de administrador)</h2>
      <table>
        <thead><tr><th>Usuário</th><th>Nome</th><th>Papel</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

async function renderDashboard(): Promise<void> {
  let me: User;
  try {
    me = await fetchMe();
  } catch {
    clearToken();
    renderLogin('Sessão expirada. Faça login novamente.');
    return;
  }

  const announcements = await fetchAnnouncements().catch(() => [] as Announcement[]);
  const adminSection =
    me.role === 'admin' ? renderUserTable(await fetchUsers().catch(() => [] as User[])) : '';

  app.innerHTML = `
    <header class="topbar">
      <span>Intranet SEPLAG</span>
      <span>
        ${escapeHtml(me.fullName)} (${escapeHtml(me.role)})
        <button id="logout">Sair</button>
      </span>
    </header>
    <main class="content">
      <section>
        <h2>Comunicados</h2>
        ${renderAnnouncements(announcements)}
      </section>
      ${adminSection}
    </main>`;

  document.querySelector<HTMLButtonElement>('#logout')!.addEventListener('click', () => {
    clearToken();
    renderLogin();
  });
}

if (getToken()) {
  void renderDashboard();
} else {
  renderLogin();
}
