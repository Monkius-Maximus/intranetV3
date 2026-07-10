import { api } from '../core/api.js';
import { acaoAdmin } from '../core/dom.js';
import { esc, escAttr, ico } from '../core/ui.js';

// Card "Links úteis" da coluna Agenda: vista dos grupos de navegação marcados
// como `destaque` (mesmo modelo da barra de menus). Aqui também mora a gestão
// da navegação dirigida por banco (admin adiciona/remove grupos e itens) —
// antes ficava na barra de menus do topo, que o redesign removeu.
export async function renderLinksCard(el, ctx) {
  const grupos = await api('/navegacao');
  ctx.navegacao = grupos;
  const destaque = grupos.filter((g) => g.destaque && g.itens.length > 0);

  // itens dos grupos em destaque, achatados (o card lista links diretos).
  const linhas = destaque.flatMap((g) =>
    g.itens.map((i) => ({ grupo: g.nome, ...i })),
  );

  el.innerHTML = `
    <div class="mini-head">${ico('link', { size: 17, color: 'var(--teal)' })} Links úteis</div>
    ${
      linhas.length === 0
        ? '<p class="empty">Nenhum link em destaque.</p>'
        : `<div class="link-list">${linhas
            .map(
              (i) => `<a class="link-row" href="${escAttr(i.url)}" target="_blank" rel="noopener" title="${escAttr(
                i.descricao || '',
              )}">
                ${ico('open_in_new', { size: 18, color: 'var(--teal)' })}
                <span>${esc(i.label)}</span>
                ${
                  ctx.admin
                    ? `<button class="row-btn danger del-item" data-id="${i.id}" title="Remover" style="margin-left:auto">${ico(
                        'close',
                        { size: 16 },
                      )}</button>`
                    : ''
                }
              </a>`,
            )
            .join('')}</div>`
    }
    ${
      ctx.admin
        ? `<div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-ghost btn-sm add-item">${ico('add', { size: 17 })} Item</button>
            <button class="btn btn-ghost btn-sm add-grupo">${ico('create_new_folder', { size: 17 })} Grupo</button>
          </div>`
        : ''
    }`;

  if (!ctx.admin) return;

  el.querySelectorAll('.del-item').forEach((b) =>
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      acaoAdmin(ctx, async () => {
        await api(`/navegacao/itens/${b.dataset.id}`, { method: 'DELETE' });
        await renderLinksCard(el, ctx);
      });
    }),
  );

  el.querySelector('.add-item')?.addEventListener('click', () => {
    const grupos = (ctx.navegacao || []).filter((g) => !g.url);
    if (grupos.length === 0) return alert('Crie um grupo primeiro.');
    const nomes = grupos.map((g, i) => `${i + 1}. ${g.nome}`).join('\n');
    const escolha = prompt(`Em qual grupo?\n${nomes}`, '1');
    const idx = Number(escolha) - 1;
    const grupo = grupos[idx];
    if (!grupo) return;
    const label = prompt('Rótulo do item:');
    if (!label) return;
    const url = prompt('URL (https://…):');
    if (!url) return;
    acaoAdmin(ctx, async () => {
      await api('/navegacao/itens', {
        method: 'POST',
        body: JSON.stringify({ grupoId: grupo.id, label, url }),
      });
      await renderLinksCard(el, ctx);
    });
  });

  el.querySelector('.add-grupo')?.addEventListener('click', () => {
    const nome = prompt('Nome do grupo (ex.: Acesso rápido):');
    if (!nome) return;
    const url = prompt('URL para link direto (deixe vazio para virar um grupo com itens):') || null;
    const destaque = url ? false : confirm('Mostrar como cards na seção "Links úteis"?');
    acaoAdmin(ctx, async () => {
      await api('/navegacao/grupos', { method: 'POST', body: JSON.stringify({ nome, url, destaque }) });
      await renderLinksCard(el, ctx);
    });
  });
}
