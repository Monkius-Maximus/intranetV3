import { api } from '../core/api.js';
import { esc, escAttr } from '../core/dom.js';

// Seção "Links úteis": é uma VISTA dos grupos de navegação marcados como
// `destaque` (mesmo modelo da barra de menus, apresentação diferente).
// A gestão (adicionar/remover) é feita na barra de menus.
export async function renderLinks(el, _ctx) {
  const grupos = await api('/navegacao');
  const destaque = grupos.filter((g) => g.destaque && g.itens.length > 0);
  el.innerHTML = `
    <h2>Links úteis</h2>
    ${
      destaque.length === 0
        ? '<p class="vazio">Nenhum link em destaque. (Marque um grupo como destaque na barra de menus.)</p>'
        : destaque
            .map(
              (g) => `<div class="link-grupo">
                <h3>${esc(g.nome)}</h3>
                ${g.itens
                  .map(
                    (i) => `<a class="link-card" href="${escAttr(i.url)}" target="_blank" rel="noopener">
                      <strong>${esc(i.label)}</strong><span>${esc(i.descricao || '')}</span></a>`,
                  )
                  .join('')}
              </div>`,
            )
            .join('')
    }`;
}
