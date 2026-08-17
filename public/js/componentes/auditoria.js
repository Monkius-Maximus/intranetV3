import { api, baixar } from '../core/api.js';
import { avatar, esc, ico, MESES_CURTOS } from '../core/ui.js';

function quandoLegivel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]} · ${hh}:${mm}`;
}

// Trilha de auditoria (admin): quem fez o quê, quando — últimos 200 registros —
// e a extração da base em CSV, para conferir tudo fora da aplicação (Excel).
export async function renderAuditoria(el, _ctx) {
  // O catálogo de extração vem do servidor já filtrado pelo papel: a tela não
  // repete a lista de conjuntos nem as regras de quem pode baixar o quê.
  const [registros, conjuntos] = await Promise.all([api('/auditoria?limite=200'), api('/exportar')]);

  el.innerHTML = `
    <div style="margin-bottom:20px">
      <h1 class="page-title">Auditoria</h1>
      <p class="page-sub" style="margin:4px 0 0">Quem fez o quê — últimas ${registros.length} ações registradas</p>
    </div>

    <div class="panel" style="padding:16px;margin-bottom:20px">
      <h2 style="margin:0;font-size:15px">Extração da base (CSV)</h2>
      <p class="page-sub" style="margin:4px 0 14px">
        Baixa cada conjunto como planilha para conferência no Excel. Sai em UTF-8 com
        separador <code>;</code> — é só abrir. Cada download fica registrado na trilha abaixo.
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        ${conjuntos
          .map(
            (c) => `<button class="btn btn-ghost baixar-csv" data-nome="${esc(c.nome)}" title="${esc(c.descricao)}">
              ${ico('download', { size: 18 })} ${esc(c.titulo)}
            </button>`,
          )
          .join('')}
      </div>
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

  for (const btn of el.querySelectorAll('.baixar-csv')) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await baixar(`/exportar/${btn.dataset.nome}.csv`, `${btn.dataset.nome}.csv`);
      } catch (err) {
        alert(`Não consegui exportar: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    });
  }
}
