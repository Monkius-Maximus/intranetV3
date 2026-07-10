import { api } from '../core/api.js';
import { avatar, esc, ico, MESES } from '../core/ui.js';

// Card "Aniversariantes" da coluna Agenda: aniversariantes do mês corrente,
// derivado das pessoas (espelha o Seplagnet). Enxuto para caber na coluna.
export async function renderAniversariantesCard(el, _ctx, { limite = 4 } = {}) {
  let pessoas = [];
  try {
    pessoas = await api('/pessoas');
  } catch {
    pessoas = [];
  }
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const dia = hoje.getDate();

  const lista = pessoas
    .filter((p) => p.birthMonth === mes && p.birthDay)
    .sort((a, b) => a.birthDay - b.birthDay || a.name.localeCompare(b.name, 'pt'));

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
    }`;
}
