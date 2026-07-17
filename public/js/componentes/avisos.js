import { api } from '../core/api.js';
import { acaoAdmin } from '../core/dom.js';
import { dataAviso, esc, escAttr, ico } from '../core/ui.js';

// Categorias de comunicado: rótulo + cor do color-coding (herdado do 1c).
// A categoria vem do banco; o fallback 'geral' cobre registros antigos.
export const CATEGORIAS = {
  geral: { label: 'Geral', cor: '#1e73be' },
  ti: { label: 'TI', cor: '#6b3fd1' },
  rh: { label: 'RH', cor: '#1f8a52' },
  urgente: { label: 'Urgente', cor: '#c0393e' },
};
const categoriaDe = (a) => CATEGORIAS[a.categoria] || CATEGORIAS.geral;

// O gestor só gerencia os PRÓPRIOS comunicados; o admin, todos (o backend
// impõe a mesma regra — isto controla só o que aparece).
const podeGerir = (a, ctx) => ctx.admin || (ctx.gestor && a.createdBy === ctx.usuario?.id);

const tamanhoLegivel = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} kB`);

function chipsAnexos(a) {
  if (!a.anexos?.length) return '';
  return `<div class="anexos">${a.anexos
    .map(
      (x) => `<a class="anexo-chip" href="/api/avisos/${a.id}/anexos/${x.id}/download" title="${escAttr(x.nome)}">
        ${ico('attach_file', { size: 15 })}<span class="n">${esc(x.nome)}</span><span class="t">${tamanhoLegivel(x.tamanho)}</span>
      </a>`,
    )
    .join('')}</div>`;
}

function cardComunicado(a, ctx) {
  const cat = categoriaDe(a);
  const acoes = podeGerir(a, ctx)
    ? `<div class="aviso-actions">
        <button class="icon-square edit-aviso" data-id="${a.id}" title="Editar">${ico('edit', { size: 18 })}</button>
        <button class="icon-square danger del-aviso" data-id="${a.id}" title="Excluir">${ico('delete', { size: 18 })}</button>
      </div>`
    : '';
  return `<article class="aviso-card" style="--aviso-accent:${cat.cor}">
    <div class="aviso-top">
      <div style="min-width:0;flex:1">
        <div class="aviso-tags">
          ${a.pinned ? '<span class="tag-fixado">FIXADO</span>' : ''}
          <span class="tag-categoria" style="--cat-cor:${cat.cor}">${esc(cat.label)}</span>
          <span class="aviso-date">${esc(dataAviso(a.createdAt))}</span>
        </div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.body)}</p>
        ${chipsAnexos(a)}
        <small>${esc(a.autor || 'Administrador do Sistema')}</small>
      </div>
      ${acoes}
    </div>
  </article>`;
}

// Fios de gestão comuns às listas de comunicados (editar/excluir).
function ligarAcoes(el, itens, ctx, recarregar) {
  if (!ctx.gestao) return;
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
      : itens.slice(0, 2).map((a) => cardComunicado(a, ctx)).join('');
  ligarAcoes(el, itens, ctx, () => renderComunicadosPreview(el, ctx));
}

// Página completa de comunicados. `manage` liga as ações de admin (Novo,
// editar, excluir) — a seção "Comunicados" é só leitura; "Gerenciar
// comunicados" é a gestão.
export async function renderComunicados(el, ctx, { manage = true } = {}) {
  const c = { ...ctx, admin: ctx.admin && manage, gestor: ctx.gestor && manage, gestao: ctx.gestao && manage };
  const itens = await api('/avisos');
  el.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px">
      <div>
        <h1 class="page-title">${manage && ctx.gestao ? 'Gerenciar comunicados' : 'Comunicados'}</h1>
        <p class="page-sub" style="margin:4px 0 0">${itens.length} comunicado(s) publicado(s)</p>
      </div>
      ${
        c.gestao
          ? `<button class="btn btn-primary novo-aviso">${ico('add', { size: 18 })} Novo comunicado</button>`
          : ''
      }
    </div>
    <div class="col" id="lista-avisos">
      ${itens.length === 0 ? '<p class="empty">Nenhum comunicado.</p>' : itens.map((a) => cardComunicado(a, c)).join('')}
    </div>`;

  el.querySelector('.novo-aviso')?.addEventListener('click', () => ctx.navegar('novo-comunicado'));
  ligarAcoes(el.querySelector('#lista-avisos'), itens, c, () => renderComunicados(el, ctx, { manage }));
}

// Tela "Novo comunicado" (3c): título, conteúdo, categoria (color-coding) e
// "fixar" são persistidos pela API. Publicação é sempre imediata e para todos.
export function renderNovoComunicado(el, ctx, { editar = null } = {}) {
  const edicao = Boolean(editar);
  let fixar = editar ? Boolean(editar.pinned) : true;
  const categoriaInicial = editar?.categoria && CATEGORIAS[editar.categoria] ? editar.categoria : 'geral';
  const novosArquivos = []; // File[] a enviar após salvar
  const anexosAtuais = [...(editar?.anexos ?? [])];

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
          <div id="c-anexos" class="anexos" style="margin:0 0 8px"></div>
          <button type="button" class="btn btn-ghost btn-sm add-arquivo">${ico('attach_file', { size: 16 })} Adicionar arquivo</button>
          <input type="file" id="c-arquivo" multiple style="display:none"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.png,.jpg,.jpeg,.gif,.zip" />
          <div class="hint" style="margin-top:6px">PDF, Office, imagens ou ZIP — até 10 MB por arquivo</div>
        </div>
      </div>

      <aside class="editor-col">
        <div class="side-card">
          <div class="title">Publicação</div>
          <div class="field" style="margin-bottom:16px">
            <div class="lbl" style="font-size:12px;color:var(--muted-2)">Categoria</div>
            <select id="c-categoria">
              ${Object.entries(CATEGORIAS)
                .map(
                  ([k, c]) =>
                    `<option value="${k}" ${k === categoriaInicial ? 'selected' : ''}>${esc(c.label)}</option>`,
                )
                .join('')}
            </select>
            <div class="hint">Define a cor do comunicado na lista</div>
          </div>
          <div class="switch-row" style="border-top:1px solid var(--line);padding-top:12px">
            <div class="st" style="display:flex;align-items:center;gap:8px">${ico('push_pin', {
              size: 18,
              color: 'var(--amber)',
            })} Fixar no topo</div>
            <button type="button" class="switch ${fixar ? 'is-on' : ''}" id="sw-fixar"></button>
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
  swFixar.addEventListener('click', () => {
    fixar = !fixar;
    swFixar.classList.toggle('is-on', fixar);
  });

  // ------------------------------------------------------------- anexos
  const elAnexos = el.querySelector('#c-anexos');
  const inputArquivo = el.querySelector('#c-arquivo');
  function pintarAnexos() {
    elAnexos.innerHTML =
      anexosAtuais
        .map(
          (x, i) => `<span class="anexo-chip">${ico('attach_file', { size: 15 })}<span class="n">${esc(x.nome)}</span>
            <button type="button" class="rm-atual" data-i="${i}" title="Remover">${ico('close', { size: 14 })}</button></span>`,
        )
        .join('') +
      novosArquivos
        .map(
          (f, i) => `<span class="anexo-chip novo">${ico('attach_file', { size: 15 })}<span class="n">${esc(f.name)}</span>
            <button type="button" class="rm-novo" data-i="${i}" title="Remover">${ico('close', { size: 14 })}</button></span>`,
        )
        .join('');
    elAnexos.querySelectorAll('.rm-novo').forEach((b) =>
      b.addEventListener('click', () => {
        novosArquivos.splice(Number(b.dataset.i), 1);
        pintarAnexos();
      }),
    );
    elAnexos.querySelectorAll('.rm-atual').forEach((b) =>
      b.addEventListener('click', () => {
        const x = anexosAtuais[Number(b.dataset.i)];
        if (!confirm(`Remover o anexo "${x.nome}"?`)) return;
        acaoAdmin(ctx, async () => {
          await api(`/avisos/${editar.id}/anexos/${x.id}`, { method: 'DELETE' });
          anexosAtuais.splice(Number(b.dataset.i), 1);
          pintarAnexos();
        });
      }),
    );
  }
  pintarAnexos();
  el.querySelector('.add-arquivo').addEventListener('click', () => inputArquivo.click());
  inputArquivo.addEventListener('change', () => {
    novosArquivos.push(...inputArquivo.files);
    inputArquivo.value = '';
    pintarAnexos();
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
      const categoria = el.querySelector('#c-categoria').value;
      const corpo = JSON.stringify({ title, body, pinned: fixar, categoria });
      const salvo = edicao
        ? await api(`/avisos/${editar.id}`, { method: 'PUT', body: corpo })
        : await api('/avisos', { method: 'POST', body: corpo });
      for (const f of novosArquivos) {
        const fd = new FormData();
        fd.append('arquivo', f);
        await api(`/avisos/${salvo.id}/anexos`, { method: 'POST', body: fd });
      }
      ctx.aoMudarAvisos?.();
      voltar();
    });
  });
}
