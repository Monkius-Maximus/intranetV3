import { api } from '../core/api.js';
import { avatar, esc, ico, MESES_CURTOS } from '../core/ui.js';

function quandoLegivel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]} · ${hh}:${mm}`;
}

// Trilha de auditoria (admin): quem fez o quê, quando — últimos 200 registros.
export async function renderAuditoria(el, _ctx) {
  const registros = await api('/auditoria?limite=200');

  el.innerHTML = `
    <div style="margin-bottom:20px">
      <h1 class="page-title">Auditoria</h1>
      <p class="page-sub" style="margin:4px 0 0">Quem fez o quê — últimas ${registros.length} ações registradas</p>
    </div>
    <div class="panel">
      ${
        registros.length === 0
          ? '<p class="empty" style="padding:24px 16px">Nenhuma ação registrada ainda.</p>'
          : `<table class="data-table">
              <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead>
              <tbody>
                ${registros
                  .map(
                    (r) => `<tr>
                      <td style="white-space:nowrap;color:var(--muted)">${esc(quandoLegivel(r.quando))}</td>
                      <td><div class="cell-user">${avatar(r.quem, { size: 30 })}<span class="nome" style="font-size:13px">${esc(
                        r.quem,
                      )}</span></div></td>
                      <td><span class="badge-role muted">${esc(r.acao)} ${esc(r.alvo)}</span></td>
                      <td style="color:var(--muted)">${esc(r.detalhe)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>`
      }
    </div>
    <p class="page-sub" style="margin-top:12px">${ico('history', { size: 16 })} O sistema guarda as últimas 2.000 ações.</p>`;
}
