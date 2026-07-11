import { api } from '../core/api.js';
import { avatar, esc, ico, MESES } from '../core/ui.js';

function aniversariantesDoMes(pessoas, mes) {
  return pessoas
    .filter((p) => p.birthMonth === mes && p.birthDay)
    .sort((a, b) => a.birthDay - b.birthDay || a.name.localeCompare(b.name, 'pt'));
}

// Card "Aniversariantes" da coluna Agenda: aniversariantes do mês corrente,
// derivado das pessoas (espelha o Seplagnet). Enxuto para caber na coluna.
export async function renderAniversariantesCard(el, ctx, { limite = 4 } = {}) {
  let pessoas = [];
  try {
    pessoas = await api('/pessoas');
  } catch {
    pessoas = [];
  }
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const dia = hoje.getDate();

  const lista = aniversariantesDoMes(pessoas, mes);

  const rotulo = (p) => {
    const setor = p.departmentFull || p.departmentCode || '';
    if (p.birthDay === dia) return `Hoje${setor ? ` · ${setor}` : ''}`;
    if (p.birthDay === dia + 1) return `Amanhã${setor ? ` · ${setor}` : ''}`;
    return `${String(p.birthDay).padStart(2, '0')}/${String(mes).padStart(2, '0')}${setor ? ` · ${setor}` : ''}`;
  };

  // aniversariantes de hoje/adiante primeiro; depois recomeça o mês.
  const ordenada = [...lista.filter((p) => p.birthDay >= dia), ...lista.filter((p) => p.birthDay < dia)];
  const mostrar = ordenada.slice(0, limite);

  el.innerHTML = `
    <div class="mini-head">${ico('cake', { size: 17, color: 'var(--pink)' })} Aniversariantes</div>
    ${
      mostrar.length === 0
        ? `<p class="empty">Nenhum aniversariante em ${MESES[mes - 1]}.</p>`
        : mostrar
            .map(
              (p) => `<div class="aniv-row">
                ${avatar(p.name, { size: 32 })}
                <div><div class="t">${esc(p.name)}</div><div class="s">${esc(rotulo(p))}</div></div>
              </div>`,
            )
            .join('')
    }
    ${
      lista.length > 0
        ? `<button class="mini-action ver-mes">${ico('cake', { size: 18 })} Ver o mês completo (${lista.length})
            ${ico('chevron_right', { size: 17, cls: 'chev' })}</button>`
        : ''
    }`;
  el.querySelector('.ver-mes')?.addEventListener('click', () => ctx.navegar('aniversariantes'));
}

// Página "Aniversariantes" (pública): o mês completo, como no Seplagnet antigo
// ("Aniversariantes do mês de <Mês>" com dia, nome e setor), com navegação
// entre meses. O mês corrente destaca o dia de hoje.
export async function renderAniversariantesPagina(el, ctx, { mes = null } = {}) {
  let pessoas = [];
  try {
    pessoas = await api('/pessoas');
  } catch {
    pessoas = [];
  }
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const m = mes ?? mesAtual;
  const lista = aniversariantesDoMes(pessoas, m);

  el.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="page-title">Aniversariantes de ${MESES[m - 1]}</h1>
        <p class="page-sub" style="margin:4px 0 0">${lista.length} aniversariante(s) no mês</p>
      </div>
      <div class="pager">
        <button class="page-btn mes-ant" title="Mês anterior">${ico('chevron_left', { size: 18 })}</button>
        ${
          m !== mesAtual
            ? `<button class="btn btn-ghost btn-sm mes-hoje" style="border-radius:7px">Mês atual</button>`
            : ''
        }
        <button class="page-btn mes-prox" title="Próximo mês">${ico('chevron_right', { size: 18 })}</button>
      </div>
    </div>
    <div class="panel">
      ${
        lista.length === 0
          ? `<p class="empty" style="padding:24px 16px">Nenhum aniversariante em ${MESES[m - 1]}.</p>`
          : `<div class="aniv-mes">
              ${lista
                .map((p) => {
                  const eHoje = m === mesAtual && p.birthDay === hoje.getDate();
                  return `<div class="aniv-mes-row ${eHoje ? 'is-hoje' : ''}">
                    <span class="dia">${String(p.birthDay).padStart(2, '0')}</span>
                    ${avatar(p.name, { size: 34 })}
                    <span class="nome">${esc(p.name)}${eHoje ? ' <span class="tag-hoje">HOJE 🎂</span>' : ''}</span>
                    <span class="setor">${esc(p.departmentFull || p.departmentCode || '')}</span>
                  </div>`;
                })
                .join('')}
            </div>`
      }
    </div>`;

  const irPara = (novo) => renderAniversariantesPagina(el, ctx, { mes: novo });
  el.querySelector('.mes-ant').addEventListener('click', () => irPara(m === 1 ? 12 : m - 1));
  el.querySelector('.mes-prox').addEventListener('click', () => irPara(m === 12 ? 1 : m + 1));
  el.querySelector('.mes-hoje')?.addEventListener('click', () => irPara(mesAtual));
}
