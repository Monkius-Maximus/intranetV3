import { api } from '../core/api.js';
import { acaoAdmin } from '../core/dom.js';
import { esc, escAttr, ico } from '../core/ui.js';

// Tiles de "Acesso rápido" dirigidos por banco. Público: clica e vai.
// Admin: lápis para editar (drawer com rótulo/URL/ícone/cor), setas para
// reordenar e um tile fantasma "+" para criar.
export async function renderTiles(el, ctx) {
  const tiles = await api('/tiles');

  el.innerHTML = `
    ${tiles
      .map(
        (t, i) => `<div class="tile-wrap">
          <button class="tile abrir" data-i="${i}" style="--tile:${escAttr(t.cor)}">
            ${ico(t.icon, { size: 23 })}<span class="tile-label">${esc(t.label)}</span>
          </button>
          ${
            ctx.admin
              ? `<div class="tile-tools">
                  ${i > 0 ? `<button class="tt mover" data-i="${i}" data-dir="-1" title="Mover p/ esquerda">${ico('chevron_left', { size: 16 })}</button>` : ''}
                  <button class="tt editar" data-i="${i}" title="Editar">${ico('edit', { size: 15 })}</button>
                  ${i < tiles.length - 1 ? `<button class="tt mover" data-i="${i}" data-dir="1" title="Mover p/ direita">${ico('chevron_right', { size: 16 })}</button>` : ''}
                </div>`
              : ''
          }
        </div>`,
      )
      .join('')}
    ${ctx.admin ? `<button class="tile tile-ghost novo-tile" title="Novo tile">${ico('add', { size: 24 })}<span class="tile-label">Adicionar</span></button>` : ''}
  `;

  const recarregar = () => renderTiles(el, ctx);

  el.querySelectorAll('.abrir').forEach((b) =>
    b.addEventListener('click', () => {
      const t = tiles[Number(b.dataset.i)];
      if (t.url.startsWith('#')) ctx.navegar(t.url.slice(1));
      else window.open(t.url, '_blank', 'noopener');
    }),
  );

  if (!ctx.admin) return;

  el.querySelectorAll('.mover').forEach((b) =>
    b.addEventListener('click', () => {
      const i = Number(b.dataset.i);
      const j = i + Number(b.dataset.dir);
      const ids = tiles.map((t) => t.id);
      [ids[i], ids[j]] = [ids[j], ids[i]];
      acaoAdmin(ctx, async () => {
        await api('/tiles/ordem', { method: 'PUT', body: JSON.stringify({ ids }) });
        await recarregar();
      });
    }),
  );
  el.querySelectorAll('.editar').forEach((b) =>
    b.addEventListener('click', () => abrirEditor(tiles[Number(b.dataset.i)])),
  );
  el.querySelector('.novo-tile')?.addEventListener('click', () => abrirEditor(null));

  // ------------------------------------------------------------ editor
  async function abrirEditor(t) {
    const edicao = Boolean(t);
    const { icones, cores } = await api('/tiles/opcoes');
    let icone = t?.icon || icones[0];
    let cor = t?.cor || cores[0];

    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="drawer" role="dialog" aria-modal="true">
        <div class="drawer-head">
          <div><h2>${edicao ? 'Editar tile' : 'Novo tile'}</h2>
            <p>Atalho do "Acesso rápido" do início</p></div>
          <button class="drawer-close" title="Fechar">${ico('close', { size: 22 })}</button>
        </div>
        <div class="drawer-body">
          <div class="field"><label>Rótulo</label>
            <input name="label" placeholder="Ex.: Contracheque" maxlength="40" value="${t ? escAttr(t.label) : ''}" /></div>
          <div class="field"><label>Endereço (URL)</label>
            <input name="url" placeholder="https://…" value="${t ? escAttr(t.url) : ''}" />
            <div class="hint">https://… abre o sistema em nova aba · #ramais ou #aniversariantes navega dentro da intranet</div></div>
          <div class="field"><div class="lbl">Ícone</div>
            <div class="icon-grid">
              ${icones
                .map(
                  (n) => `<button type="button" class="icon-opt ${n === icone ? 'is-on' : ''}" data-icon="${n}" title="${n}">${ico(
                    n,
                    { size: 22 },
                  )}</button>`,
                )
                .join('')}
            </div></div>
          <div class="field"><div class="lbl">Cor</div>
            <div class="swatches">
              ${cores
                .map(
                  (c) => `<button type="button" class="swatch ${c === cor ? 'is-on' : ''}" data-cor="${c}" style="background:${c}" title="${c}"></button>`,
                )
                .join('')}
            </div></div>
          <div class="field"><div class="lbl">Prévia</div>
            <div style="max-width:140px"><div class="tile" id="tile-previa" style="--tile:${cor};cursor:default">
              ${ico(icone, { size: 23 })}<span class="tile-label">${t ? esc(t.label) : 'Novo tile'}</span>
            </div></div></div>
        </div>
        <div class="drawer-foot">
          ${edicao ? `<button class="btn-danger-link excluir">${ico('delete', { size: 18 })} Excluir</button>` : ''}
          <div class="spacer"></div>
          <button class="btn btn-ghost cancelar">Cancelar</button>
          <button class="btn btn-primary salvar">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);

    const fechar = () => ov.remove();
    ov.addEventListener('mousedown', (e) => {
      if (e.target === ov) fechar();
    });
    ov.querySelector('.drawer-close').addEventListener('click', fechar);
    ov.querySelector('.cancelar').addEventListener('click', fechar);

    const previa = ov.querySelector('#tile-previa');
    const atualizarPrevia = () => {
      previa.style.setProperty('--tile', cor);
      previa.innerHTML = `${ico(icone, { size: 23 })}<span class="tile-label">${esc(
        ov.querySelector('[name=label]').value.trim() || 'Novo tile',
      )}</span>`;
    };
    ov.querySelector('[name=label]').addEventListener('input', atualizarPrevia);
    ov.querySelectorAll('.icon-opt').forEach((b) =>
      b.addEventListener('click', () => {
        icone = b.dataset.icon;
        ov.querySelectorAll('.icon-opt').forEach((x) => x.classList.toggle('is-on', x === b));
        atualizarPrevia();
      }),
    );
    ov.querySelectorAll('.swatch').forEach((b) =>
      b.addEventListener('click', () => {
        cor = b.dataset.cor;
        ov.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('is-on', x === b));
        atualizarPrevia();
      }),
    );

    ov.querySelector('.excluir')?.addEventListener('click', () => {
      if (!confirm(`Excluir o tile "${t.label}"?`)) return;
      acaoAdmin(ctx, async () => {
        await api(`/tiles/${t.id}`, { method: 'DELETE' });
        fechar();
        await recarregar();
      });
    });

    ov.querySelector('.salvar').addEventListener('click', () => {
      const label = ov.querySelector('[name=label]').value.trim();
      const url = ov.querySelector('[name=url]').value.trim();
      if (!label || !url) {
        alert('Preencha rótulo e endereço.');
        return;
      }
      const corpo = JSON.stringify({ label, url, icon: icone, cor });
      acaoAdmin(ctx, async () => {
        if (edicao) await api(`/tiles/${t.id}`, { method: 'PUT', body: corpo });
        else await api('/tiles', { method: 'POST', body: corpo });
        fechar();
        await recarregar();
      });
    });
  }
}
