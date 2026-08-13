import { avatar, esc, ico, marcaHtml } from '../core/ui.js';

// Barra lateral de navegação (substitui a antiga barra de menus do topo).
// A navegação entre sistemas externos foi para os tiles/Links úteis; a sidebar
// é a navegação interna do portal, com um grupo "Administração" para o admin.

const ITENS = [
  { key: 'inicio', label: 'Início', icon: 'home' },
  { key: 'comunicados', label: 'Comunicados', icon: 'campaign' },
  { key: 'ramais', label: 'Ramais', icon: 'contacts' },
  { key: 'aniversariantes', label: 'Aniversariantes', icon: 'cake' },
];
const ITENS_GESTAO = [
  { key: 'usuarios', label: 'Pessoas', icon: 'group' },
  { key: 'gerenciar-comunicados', label: 'Gerenciar comunicados', icon: 'edit_note' },
];
const ITENS_ADMIN = [
  { key: 'paginas', label: 'Páginas', icon: 'create_new_folder' },
  { key: 'contas', label: 'Contas de acesso', icon: 'shield_person' },
  { key: 'auditoria', label: 'Auditoria', icon: 'history' },
];

// Páginas criadas pela tela (recursos dirigidos por dados) entram no menu como
// qualquer outra — a lista vem do servidor, não do código.
const itensDeRecursos = (recursos) =>
  (recursos || []).map((r) => ({ key: `r:${r.chave}`, label: r.nome, icon: r.icone || 'folder_open' }));

// A view atual pode não ser exatamente a chave do menu (ex.: novo-comunicado
// destaca "Gerenciar comunicados").
function chaveAtiva(view) {
  if (view === 'novo-comunicado') return 'gerenciar-comunicados';
  return view;
}

export function renderSidebar(el, ctx) {
  const ativa = chaveAtiva(ctx.view);
  const item = (i) =>
    `<button class="nav-item ${i.key === ativa ? 'is-active' : ''}" data-view="${i.key}">${ico(i.icon, {
      size: 21,
    })}<span>${esc(i.label)}</span></button>`;

  el.innerHTML = `
    <div class="sidebar-brand">
      ${marcaHtml(ctx.perfil)}
      <div><div class="brand-name">${esc(ctx.perfil?.nome || '')}</div><div class="brand-sub">${esc(
        ctx.perfil?.organizacao || '',
      )}</div></div>
    </div>
    <nav class="sidebar-nav">
      ${ITENS.map(item).join('')}
      ${itensDeRecursos(ctx.recursos).map(item).join('')}
      ${
        ctx.gestao
          ? `<div class="nav-group-label">${ctx.admin ? 'Administração' : 'Gestão'}</div>${ITENS_GESTAO.map(item).join('')}`
          : ''
      }
      ${ctx.admin ? ITENS_ADMIN.map(item).join('') : ''}
    </nav>
    <div class="sidebar-foot">
      ${
        ctx.gestao
          ? `<div class="user-chip">
              ${avatar(ctx.usuario?.name || 'Administrador', { size: 36 })}
              <div class="meta"><div class="nome">${esc(ctx.usuario?.name || 'Administrador')}</div>
                <div class="papel admin">${
                  { admin: 'admin', gestor: 'gestor', viewer: 'leitura' }[ctx.usuario?.role] || ''
                }</div></div>
              <button class="chip-logout trocar-senha" title="Trocar senha">${ico('key', { size: 19 })}</button>
              <button class="chip-logout" title="Sair">${ico('logout', { size: 20 })}</button>
            </div>`
          : `<button class="btn-login-side">${ico('lock', { size: 18 })} Entrar como admin</button>`
      }
    </div>`;

  el.querySelectorAll('.nav-item').forEach((b) =>
    b.addEventListener('click', () => ctx.navegar(b.dataset.view)),
  );
  el.querySelector('.trocar-senha')?.addEventListener('click', ctx.trocarSenha);
  el.querySelector('.chip-logout:not(.trocar-senha)')?.addEventListener('click', ctx.sair);
  el.querySelector('.btn-login-side')?.addEventListener('click', ctx.entrar);
}
