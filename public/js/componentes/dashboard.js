import { api } from '../core/api.js';
import { dataLonga, esc, ico, MESES_CURTOS, saudacao } from '../core/ui.js';
import { renderComunicadosPreview } from './avisos.js';
import { renderAniversariantesCard } from './aniversariantes.js';
import { renderLinksCard } from './links.js';

// Tiles de acesso rápido (color-coded, herdados do 1c em tamanho menor — 1b).
// Cada tile abre um sistema externo ou navega para uma seção interna.
const TILES = [
  { icon: 'badge', label: 'Ponto', color: '#1e73be', url: 'https://ponto.seplag.pe.gov.br' },
  { icon: 'request_quote', label: 'Contracheque', color: '#1f8a52', url: 'https://portal.seplag.pe.gov.br' },
  { icon: 'event_available', label: 'Férias', color: '#c46a12', url: 'https://portal.seplag.pe.gov.br' },
  { icon: 'support_agent', label: 'Suporte', color: '#6b3fd1', url: 'https://sei.pe.gov.br' },
  { icon: 'menu_book', label: 'Manuais', color: '#b23c6e', url: 'https://ead.igpe.pe.gov.br' },
  { icon: 'groups', label: 'Ramais', color: '#0f7a86', view: 'ramais' },
];

// Próximos eventos — dado de exemplo (a Agenda ainda não tem backend).
function eventosExemplo() {
  const hoje = new Date();
  const em = (dias) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() + dias);
    return d;
  };
  return [
    { data: hoje, titulo: 'Reunião de equipe', sub: '10h · Sala 3', hoje: true },
    { data: em(5), titulo: 'Prazo — relatório mensal', sub: 'Fim do expediente' },
  ];
}

export async function renderDashboard(el, ctx) {
  const [avisos, pessoas] = await Promise.all([
    api('/avisos').catch(() => []),
    ctx.admin ? api('/pessoas').catch(() => []) : Promise.resolve([]),
  ]);

  const nome = ctx.admin ? 'Administrador' : ctx.usuario?.name || '';
  const subAdmin = 'Você tem permissões de gestão neste ambiente';
  const subUser = `${dataLonga()} — ${avisos.length} comunicado${avisos.length === 1 ? '' : 's'}`;

  el.innerHTML = `
    <h1 class="page-title">${saudacao()}${nome ? `, ${esc(nome)}` : ''}</h1>
    <p class="page-sub">${ctx.admin ? subAdmin : subUser}</p>

    <div class="section-label">Acesso rápido</div>
    <div class="tiles">
      ${TILES.map(
        (t, i) => `<button class="tile" data-i="${i}" style="--tile:${t.color}">
          ${ico(t.icon, { size: 23 })}<span class="tile-label">${esc(t.label)}</span>
        </button>`,
      ).join('')}
    </div>

    <div class="grid-main">
      <div>
        <div class="section-head">
          <div class="section-label" style="margin:0">Comunicados</div>
          ${
            ctx.admin
              ? `<button class="btn btn-primary btn-sm novo-aviso">${ico('add', { size: 17 })} Novo comunicado</button>`
              : '<button class="link-ver ver-todos">Ver todos</button>'
          }
        </div>
        <div class="col" id="dash-avisos"></div>
      </div>
      <div>
        <div class="section-label">${ctx.admin ? 'Painel administrativo' : 'Agenda'}</div>
        <div class="col">
          ${ctx.admin ? '' : `<div class="mini-card" id="dash-eventos"></div>`}
          ${ctx.admin ? `<div class="mini-card" id="dash-painel"></div>` : ''}
          <div class="mini-card" id="dash-aniv"></div>
          <div class="mini-card" id="dash-links"></div>
        </div>
      </div>
    </div>`;

  // tiles
  el.querySelectorAll('.tile').forEach((b) =>
    b.addEventListener('click', () => {
      const t = TILES[Number(b.dataset.i)];
      if (t.view) ctx.navegar(t.view);
      else if (t.url && t.url !== '#') window.open(t.url, '_blank', 'noopener');
    }),
  );
  el.querySelector('.novo-aviso')?.addEventListener('click', () => ctx.navegar('novo-comunicado'));
  el.querySelector('.ver-todos')?.addEventListener('click', () => ctx.navegar('comunicados'));

  // próximos eventos (usuário)
  const elEventos = el.querySelector('#dash-eventos');
  if (elEventos) {
    elEventos.innerHTML = `
      <div class="mini-head">${ico('event', { size: 17, color: 'var(--brand)' })} Próximos eventos</div>
      ${eventosExemplo()
        .map(
          (e) => `<div class="event-row">
            <div class="event-date"><div class="m ${e.hoje ? 'hoje' : ''}">${MESES_CURTOS[
            e.data.getMonth()
          ].toUpperCase()}</div><div class="d">${e.data.getDate()}</div></div>
            <div class="event-info"><div class="t">${esc(e.titulo)}</div><div class="s">${esc(e.sub)}</div></div>
          </div>`,
        )
        .join('')}`;
  }

  // painel administrativo (admin)
  const elPainel = el.querySelector('#dash-painel');
  if (elPainel) {
    elPainel.innerHTML = `
      <div class="mini-stats">
        <div class="mini-stat"><div class="n">${pessoas.length}</div><div class="l">Pessoas</div></div>
        <div class="mini-stat"><div class="n">${avisos.length}</div><div class="l">Comunicados</div></div>
      </div>
      <button class="mini-action ir-usuarios">${ico('group', { size: 18 })} Gerenciar usuários ${ico('chevron_right', {
      size: 17,
      cls: 'chev',
    })}</button>`;
    elPainel.querySelector('.ir-usuarios').addEventListener('click', () => ctx.navegar('usuarios'));
  }

  await Promise.all([
    renderComunicadosPreview(el.querySelector('#dash-avisos'), ctx),
    renderAniversariantesCard(el.querySelector('#dash-aniv'), ctx),
    renderLinksCard(el.querySelector('#dash-links'), ctx),
  ]);
}
