import { api } from '../core/api.js';
import { dataLonga, esc, ico, saudacao } from '../core/ui.js';
import { renderComunicadosPreview } from './avisos.js';
import { renderAniversariantesCard } from './aniversariantes.js';
import { renderLinksCard } from './links.js';
import { renderTiles } from './tiles.js';
import { renderEventosCard } from './eventos.js';

// Início: tiles (banco), comunicados (banco), coluna Agenda (eventos +
// aniversariantes + links úteis, tudo do banco). Admin ganha o painel
// administrativo e as ações de gestão inline em cada card.
export async function renderDashboard(el, ctx) {
  const [avisos, pessoas] = await Promise.all([
    api('/avisos').catch(() => []),
    ctx.gestao ? api('/pessoas').catch(() => []) : Promise.resolve([]),
  ]);

  const nome = ctx.usuario?.name || (ctx.gestao ? 'Administrador' : '');
  const subAdmin = 'Você tem permissões de gestão neste ambiente';
  const subUser = `${dataLonga()} — ${avisos.length} comunicado${avisos.length === 1 ? '' : 's'}`;

  el.innerHTML = `
    <h1 class="page-title">${saudacao()}${nome ? `, ${esc(nome)}` : ''}</h1>
    <p class="page-sub">${ctx.gestao ? subAdmin : subUser}</p>

    <div class="section-label">Acesso rápido</div>
    <div class="tiles" id="dash-tiles"></div>

    <div class="grid-main">
      <div>
        <div class="section-head">
          <div class="section-label" style="margin:0">Comunicados</div>
          ${
            ctx.gestao
              ? `<button class="btn btn-primary btn-sm novo-aviso">${ico('add', { size: 17 })} Novo comunicado</button>`
              : '<button class="link-ver ver-todos">Ver todos</button>'
          }
        </div>
        <div class="col" id="dash-avisos"></div>
      </div>
      <div>
        <div class="section-label">${ctx.gestao ? 'Painel de gestão' : 'Agenda'}</div>
        <div class="col">
          ${ctx.gestao ? `<div class="mini-card" id="dash-painel"></div>` : ''}
          <div class="mini-card" id="dash-eventos"></div>
          <div class="mini-card" id="dash-aniv"></div>
          <div class="mini-card" id="dash-links"></div>
        </div>
      </div>
    </div>`;

  el.querySelector('.novo-aviso')?.addEventListener('click', () => ctx.navegar('novo-comunicado'));
  el.querySelector('.ver-todos')?.addEventListener('click', () => ctx.navegar('comunicados'));

  // painel administrativo (admin)
  const elPainel = el.querySelector('#dash-painel');
  if (elPainel) {
    elPainel.innerHTML = `
      <div class="mini-stats">
        <div class="mini-stat"><div class="n">${pessoas.length}</div><div class="l">Pessoas</div></div>
        <div class="mini-stat"><div class="n">${avisos.length}</div><div class="l">Comunicados</div></div>
      </div>
      <button class="mini-action ir-usuarios">${ico('group', { size: 18 })} Gerenciar pessoas ${ico('chevron_right', {
      size: 17,
      cls: 'chev',
    })}</button>`;
    elPainel.querySelector('.ir-usuarios').addEventListener('click', () => ctx.navegar('usuarios'));
  }

  await Promise.all([
    renderTiles(el.querySelector('#dash-tiles'), ctx),
    renderComunicadosPreview(el.querySelector('#dash-avisos'), ctx),
    renderEventosCard(el.querySelector('#dash-eventos'), ctx),
    renderAniversariantesCard(el.querySelector('#dash-aniv'), ctx),
    renderLinksCard(el.querySelector('#dash-links'), ctx),
  ]);
}
