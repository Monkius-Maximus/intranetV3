import { api } from '../core/api.js';
import { esc } from '../core/dom.js';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Aniversariantes do mês corrente (derivado das pessoas). Espelha o Seplagnet:
// "+Aniversariantes do mês de <Mês>" com dia, nome e setor.
export async function renderAniversariantes(el, _ctx) {
  const pessoas = await api('/pessoas');
  const mes = new Date().getMonth() + 1;
  const lista = pessoas
    .filter((p) => p.birthMonth === mes && p.birthDay)
    .sort((a, b) => a.birthDay - b.birthDay || a.name.localeCompare(b.name, 'pt'));

  el.innerHTML = `
    <h2 class="aniv-titulo">+Aniversariantes do mês de ${MESES[mes - 1]}</h2>
    ${
      lista.length === 0
        ? '<p class="vazio">Nenhum aniversariante neste mês.</p>'
        : `<ol class="aniv-lista">${lista
            .map(
              (p) => `<li>
                <span class="aniv-dia">${String(p.birthDay).padStart(2, '0')}</span>
                <span>${esc(p.name)}</span>
                <span class="aniv-setor">${esc(p.departmentFull || p.departmentCode || '')}</span>
              </li>`,
            )
            .join('')}</ol>`
    }`;
}
