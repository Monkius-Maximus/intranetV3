import { api } from '../core/api.js';
import { acaoAdmin } from '../core/dom.js';
import { dataAviso, esc, ico } from '../core/ui.js';

// Paleta das bordas dos cards de comunicado (color-coded, herdado do 1c).
const ACCENTS = ['#1e73be', '#c46a12', '#1f8a52', '#6b3fd1', '#b23c6e', '#0f7a86'];
const accentDe = (a, i) => (a.pinned ? '#1e73be' : ACCENTS[i % ACCENTS.length]);

function cardComunicado(a, i, ctx) {
  const acoes = ctx.admin
    ? `<div class="aviso-actions">
        <button class="icon-square edit-aviso" data-id="${a.id}" title="Editar">${ico('edit', { size: 18 })}</button>
        <button class="icon-square danger del-aviso" data-id="${a.id}" title="Excluir">${ico('delete', { size: 18 })}</button>
      </div>`
    : '';
  return `<article class="aviso-card" style="--aviso-accent:${accentDe(a, i)}">
    <div class="aviso-top">
      <div style="min-width:0">
        <div class="aviso-tags">
          ${a.pinned ? '<span class="tag-fixado">FIXADO</span>' : ''}
          <span class="aviso-date">${esc(dataAviso(a.createdAt))}</span>
        </div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.body)}</p>
        <small>${esc(a.autor || 'Administrador do Sistema')}</small>
      </div>
      ${acoes}
    </div>
  </article>`;
}

// Fios de admin comuns às listas de comunicados (editar/excluir).
function ligarAcoes(el, itens, ctx, recarregar) {
  if (!ctx.admin) return;
  el.querySelectorAll('.del-aviso').forEach((b) =>
    b.addEventListener('click', () => {
      if (!confirm('Excluir este comunicado?')) return;
      acaoAdmin(ctx, async () => {
        await api(`/avisos/${b.dataset.id}`, { method: 'DELETE' });
        await recarregar();
        ctx.aoMudarAvisos?.();
      });
    }),
  );
  el.querySelectorAll('.edit-aviso').forEach((b) =>
    b.addEventListener('click', () => {
      const a = itens.find((x) => String(x.id) === b.dataset.id);
      if (a) ctx.navegar('novo-comunicado', { editar: a });
    }),
  );
}

// Prévia dos 2 comunicados mais recentes (dashboard).
export async function renderComunicadosPreview(el, ctx) {
  const itens = await api('/avisos');
  el.innerHTML =
    itens.length === 0
      ? '<p class="empty">Nenhum comunicado.</p>'
      : itens.slice(0, 2).map((a, i) => cardComunicado(a, i, ctx)).join('');
  ligarAcoes(el, itens, ctx, () => renderComunicadosPreview(el, ctx));
}

// Página completa de comunicados. `manage` liga as ações de admin (Novo,
// editar, excluir) — a seção "Comunicados" é só leitura; "Gerenciar
// comunicados" é a gestão.
export async function renderComunicados(el, ctx, { manage = true } = {}) {
  const c = { ...ctx, admin: ctx.admin && manage };
  const itens = await api('/avisos');
  el.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px">
      <div>
        <h1 class="page-title">${manage && ctx.admin ? 'Gerenciar comunicados' : 'Comunicados'}</h1>
        <p class="page-sub" style="margin:4px 0 0">${itens.length} comunicado(s) publicado(s)</p>
      </div>
      ${
        c.admin
          ? `<button class="btn btn-primary novo-aviso">${ico('add', { size: 18 })} Novo comunicado</button>`
          : ''
      }
    </div>
    <div class="col" id="lista-avisos">
      ${itens.length === 0 ? '<p class="empty">Nenhum comunicado.</p>' : itens.map((a, i) => cardComunicado(a, i, c)).join('')}
    </div>`;

  el.querySelector('.novo-aviso')?.addEventListener('click', () => ctx.navegar('novo-comunicado'));
  ligarAcoes(el.querySelector('#lista-avisos'), itens, c, () => renderComunicados(el, ctx, { manage }));
}

// Tela "Novo comunicado" (3c). Backend suporta título, conteúdo e "fixar";
// público-alvo, categoria, anexos, notificação e agendamento ficam como campos
// visuais do protótipo (ainda não persistidos pela API).
export function renderNovoComunicado(el, ctx, { editar = null } = {}) {
  const edicao = Boolean(editar);
  let fixar = editar ? Boolean(editar.pinned) : true;
  let notificar = false;

  el.innerHTML = `
    <div class="crumbs">
      <button class="link-ver ir-comunicados" style="color:var(--muted-2)">Comunicados</button>
      ${ico('chevron_right', { size: 16 })}
      <span class="atual">${edicao ? 'Editar' : 'Novo'}</span>
    </div>
    <h1 class="page-title" style="margin-bottom:20px">${edicao ? 'Editar comunicado' : 'Novo comunicado'}</h1>

    <div class="editor-grid">
      <div class="editor-col">
        <div class="field">
          <label>Título</label>
          <input id="c-titulo" placeholder="Ex.: Recesso de fim de ano" value="${editar ? esc(editar.title) : ''}" />
        </div>
        <div class="field">
          <label>Conteúdo</label>
          <div class="editor">
            <div class="editor-toolbar">
              <button class="tb" type="button">${ico('format_bold', { size: 19 })}</button>
              <button class="tb" type="button">${ico('format_italic', { size: 19 })}</button>
              <span class="sep"></span>
              <button class="tb" type="button">${ico('format_list_bulleted', { size: 19 })}</button>
              <button class="tb" type="button">${ico('format_list_numbered', { size: 19 })}</button>
              <span class="sep"></span>
              <button class="tb" type="button">${ico('link', { size: 19 })}</button>
              <button class="tb" type="button">${ico('image', { size: 19 })}</button>
            </div>
            <textarea id="c-conteudo" placeholder="Escreva o comunicado para os servidores…">${
              editar ? esc(editar.body) : ''
            }</textarea>
          </div>
        </div>
        <div class="field">
          <label>Anexos</label>
          <div class="dropzone">
            ${ico('upload_file', { size: 26, color: 'var(--faint)' })}
            <div class="big">Arraste arquivos ou <strong style="color:var(--navy)">selecione</strong></div>
            <div class="small">PDF, DOCX ou imagens até 10 MB</div>
          </div>
        </div>
      </div>

      <aside class="editor-col">
        <div class="side-card">
          <div class="title">Publicação</div>
          <div class="field" style="margin-bottom:14px">
            <div class="lbl" style="font-size:12px;color:var(--muted-2)">Público-alvo</div>
            <select><option>Todos os servidores</option><option>Por setor</option></select>
          </div>
          <div class="field" style="margin-bottom:16px">
            <div class="lbl" style="font-size:12px;color:var(--muted-2)">Categoria</div>
            <select><option>Geral</option><option>TI</option><option>RH</option><option>Urgente</option></select>
          </div>
          <div class="switch-row" style="border-top:1px solid var(--line);padding-top:12px">
            <div class="st" style="display:flex;align-items:center;gap:8px">${ico('push_pin', {
              size: 18,
              color: 'var(--amber)',
            })} Fixar no topo</div>
            <button type="button" class="switch ${fixar ? 'is-on' : ''}" id="sw-fixar"></button>
          </div>
          <div class="switch-row" style="padding-top:8px">
            <div class="st" style="display:flex;align-items:center;gap:8px">${ico('notifications', {
              size: 18,
              color: 'var(--brand)',
            })} Notificar por e-mail</div>
            <button type="button" class="switch ${notificar ? 'is-on' : ''}" id="sw-notif"></button>
          </div>
        </div>
        <div class="side-card">
          <div class="lbl" style="font-size:12px;color:var(--muted-2);font-weight:600;margin-bottom:6px">Data de publicação</div>
          <div class="field"><div style="display:flex;align-items:center;gap:9px;border:1px solid var(--field-border);border-radius:8px;padding:9px 11px;font-size:13px">${ico(
            'calendar_today',
            { size: 18, color: 'var(--faint)' },
          )} Imediata</div></div>
        </div>
      </aside>
    </div>

    <div class="form-actions">
      <div class="spacer">${edicao ? 'Alterações substituem o comunicado atual' : 'Rascunho salvo automaticamente'}</div>
      <button class="btn btn-ghost cancelar">Cancelar</button>
      <button class="btn btn-primary publicar">${ico('send', { size: 18 })} ${edicao ? 'Salvar' : 'Publicar'}</button>
    </div>`;

  const swFixar = el.querySelector('#sw-fixar');
  const swNotif = el.querySelector('#sw-notif');
  swFixar.addEventListener('click', () => {
    fixar = !fixar;
    swFixar.classList.toggle('is-on', fixar);
  });
  swNotif.addEventListener('click', () => {
    notificar = !notificar;
    swNotif.classList.toggle('is-on', notificar);
  });

  const voltar = () => ctx.navegar(ctx.admin ? 'gerenciar-comunicados' : 'comunicados');
  el.querySelector('.ir-comunicados').addEventListener('click', voltar);
  el.querySelector('.cancelar').addEventListener('click', voltar);

  el.querySelector('.publicar').addEventListener('click', () => {
    const title = el.querySelector('#c-titulo').value.trim();
    const body = el.querySelector('#c-conteudo').value.trim();
    if (!title || !body) {
      alert('Preencha o título e o conteúdo.');
      return;
    }
    acaoAdmin(ctx, async () => {
      await api('/avisos', { method: 'POST', body: JSON.stringify({ title, body, pinned: fixar }) });
      // A API não tem update: "editar" recria e remove o antigo.
      if (edicao) await api(`/avisos/${editar.id}`, { method: 'DELETE' });
      ctx.aoMudarAvisos?.();
      voltar();
    });
  });
}
