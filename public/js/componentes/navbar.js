import { api } from '../core/api.js';
import { acaoAdmin, esc, escAttr } from '../core/dom.js';

// Barra de menus dirigida por banco (grupos = dropdowns ou links diretos).
// Fonte: GET /api/navegacao. Admin adiciona/remove grupos e itens aqui mesmo.
export async function renderNavbar(el, ctx) {
  const grupos = await api('/navegacao');
  ctx.navegacao = grupos; // compartilha com o componente de links (destaque)

  el.innerHTML = grupos
    .map((g) => {
      if (g.url) {
        return `<a class="menu-link" href="${escAttr(g.url)}" target="_blank" rel="noopener">${esc(g.nome)}</a>`;
      }
      return `<div class="menu">
        <button class="menu-btn" type="button">${esc(g.nome)} ▾</button>
        <div class="menu-drop">
          ${g.itens
            .map(
              (i) => `<a href="${escAttr(i.url)}" target="_blank" rel="noopener" title="${escAttr(i.descricao || '')}">
                ${esc(i.label)}${ctx.admin ? ` <button class="link del-item" data-id="${i.id}">×</button>` : ''}</a>`,
            )
            .join('')}
          ${ctx.admin ? `<button class="menu-add-item" data-grupo="${g.id}">+ item</button>` : ''}
        </div>
      </div>`;
    })
    .join('') + (ctx.admin ? `<button class="menu-add-grupo" type="button">+ grupo</button>` : '');

  if (!ctx.admin) return;

  el.querySelectorAll('.del-item').forEach((b) =>
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      acaoAdmin(ctx, async () => {
        await api(`/navegacao/itens/${b.dataset.id}`, { method: 'DELETE' });
        await renderNavbar(el, ctx);
      });
    }),
  );

  el.querySelectorAll('.menu-add-item').forEach((b) =>
    b.addEventListener('click', () => {
      const label = prompt('Rótulo do item:');
      if (!label) return;
      const url = prompt('URL (https://…):');
      if (!url) return;
      acaoAdmin(ctx, async () => {
        await api('/navegacao/itens', {
          method: 'POST',
          body: JSON.stringify({ grupoId: Number(b.dataset.grupo), label, url }),
        });
        await renderNavbar(el, ctx);
      });
    }),
  );

  el.querySelector('.menu-add-grupo')?.addEventListener('click', () => {
    const nome = prompt('Nome do grupo (ex.: Sistemas):');
    if (!nome) return;
    const url = prompt('URL para link direto (deixe vazio para virar um menu com itens):') || null;
    const destaque = url ? false : confirm('Mostrar também como cards na seção "Links úteis"?');
    acaoAdmin(ctx, async () => {
      await api('/navegacao/grupos', { method: 'POST', body: JSON.stringify({ nome, url, destaque }) });
      await renderNavbar(el, ctx);
      if (ctx.aoMudarNavegacao) await ctx.aoMudarNavegacao();
    });
  });
}
