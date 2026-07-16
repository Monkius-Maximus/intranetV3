import { api } from '../core/api.js';
import { acaoAdmin } from '../core/dom.js';
import { esc, escAttr, ico, MESES_CURTOS } from '../core/ui.js';

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Card "Próximos eventos" — agenda real gerida pelo admin (substituiu o dado
// de exemplo do protótipo). Mostra os próximos `limite` a partir de hoje.
export async function renderEventosCard(el, ctx, { limite = 3 } = {}) {
  let eventos = [];
  try {
    eventos = await api('/eventos');
  } catch {
    eventos = [];
  }
  const hoje = hojeIso();
  const proximos = eventos.filter((e) => e.data >= hoje).slice(0, limite);

  const linha = (e) => {
    const [, m, d] = e.data.split('-').map(Number);
    const eHoje = e.data === hoje;
    const sub = [e.hora, e.local].filter(Boolean).join(' · ');
    return `<div class="event-row" data-id="${e.id}">
      <div class="event-date"><div class="m ${eHoje ? 'hoje' : ''}">${MESES_CURTOS[m - 1].toUpperCase()}</div><div class="d">${d}</div></div>
      <div class="event-info" style="min-width:0;flex:1"><div class="t">${esc(e.titulo)}</div>${
        sub ? `<div class="s">${esc(sub)}</div>` : ''
      }</div>
      ${
        ctx.admin
          ? `<div class="event-tools">
              <button class="row-btn ed" data-id="${e.id}" title="Editar">${ico('edit', { size: 17 })}</button>
              <button class="row-btn danger del" data-id="${e.id}" title="Excluir">${ico('delete', { size: 17 })}</button>
            </div>`
          : ''
      }
    </div>`;
  };

  el.innerHTML = `
    <div class="mini-head" style="justify-content:space-between">
      <span style="display:flex;align-items:center;gap:8px">${ico('event', { size: 17, color: 'var(--brand)' })} Próximos eventos</span>
      ${ctx.admin ? `<button class="row-btn novo-evento" title="Novo evento">${ico('add', { size: 18 })}</button>` : ''}
    </div>
    ${proximos.length === 0 ? '<p class="empty">Nenhum evento agendado.</p>' : proximos.map(linha).join('')}`;

  if (!ctx.admin) return;
  const recarregar = () => renderEventosCard(el, ctx, { limite });

  el.querySelector('.novo-evento').addEventListener('click', () => abrirEditor(null));
  el.querySelectorAll('.ed').forEach((b) =>
    b.addEventListener('click', () => abrirEditor(eventos.find((e) => String(e.id) === b.dataset.id))),
  );
  el.querySelectorAll('.del').forEach((b) =>
    b.addEventListener('click', () => {
      const e = eventos.find((x) => String(x.id) === b.dataset.id);
      if (!e || !confirm(`Excluir o evento "${e.titulo}"?`)) return;
      acaoAdmin(ctx, async () => {
        await api(`/eventos/${e.id}`, { method: 'DELETE' });
        await recarregar();
      });
    }),
  );

  function abrirEditor(e) {
    const edicao = Boolean(e);
    const ov = document.createElement('div');
    ov.className = 'overlay center';
    ov.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" style="text-align:left">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          ${ico('event', { size: 22, color: 'var(--brand)' })}
          <h3 style="margin:0">${edicao ? 'Editar evento' : 'Novo evento'}</h3>
        </div>
        <div class="field" style="margin-bottom:12px"><label>Título</label>
          <input name="titulo" placeholder="Ex.: Reunião de equipe" maxlength="120" value="${e ? escAttr(e.titulo) : ''}" /></div>
        <div class="field" style="margin-bottom:12px"><label>Data</label>
          <input name="data" type="date" value="${e ? escAttr(e.data) : hojeIso()}" /></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px">
          <div class="field"><label>Hora (opcional)</label>
            <input name="hora" placeholder="10h" maxlength="20" value="${e ? escAttr(e.hora || '') : ''}" /></div>
          <div class="field"><label>Local (opcional)</label>
            <input name="local" placeholder="Sala 3" maxlength="80" value="${e ? escAttr(e.local || '') : ''}" /></div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost cancelar">Cancelar</button>
          <button class="btn btn-primary salvar">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const fechar = () => ov.remove();
    ov.addEventListener('mousedown', (ev) => {
      if (ev.target === ov) fechar();
    });
    ov.querySelector('.cancelar').addEventListener('click', fechar);
    ov.querySelector('.salvar').addEventListener('click', () => {
      const v = (n) => ov.querySelector(`[name=${n}]`).value.trim();
      if (!v('titulo') || !v('data')) {
        alert('Preencha título e data.');
        return;
      }
      const corpo = JSON.stringify({ titulo: v('titulo'), data: v('data'), hora: v('hora') || null, local: v('local') || null });
      acaoAdmin(ctx, async () => {
        if (edicao) await api(`/eventos/${e.id}`, { method: 'PUT', body: corpo });
        else await api('/eventos', { method: 'POST', body: corpo });
        fechar();
        await recarregar();
      });
    });
  }
}
