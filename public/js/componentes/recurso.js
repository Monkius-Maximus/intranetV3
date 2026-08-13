import { api } from '../core/api.js';
import { acaoAdmin } from '../core/dom.js';
import { esc, escAttr, ico } from '../core/ui.js';

// Tela GENÉRICA de um recurso dirigido por dados. Não conhece "Estoque" nem
// "Gastos": recebe a definição do servidor e desenha a tabela e o formulário a
// partir dela. É o que permite criar uma página nova sem programar.

const PAGE_SIZE = 10;

// ------------------------------------------------------------ apresentação
function formatar(valor, campo) {
  if (valor === null || valor === undefined || valor === '') return '—';
  switch (campo.tipo) {
    case 'booleano':
      return valor ? 'Sim' : 'Não';
    case 'data': {
      const [a, m, d] = String(valor).split('-');
      return d ? `${d}/${m}/${a}` : String(valor);
    }
    case 'numero':
      return new Intl.NumberFormat('pt-BR').format(Number(valor));
    default:
      return String(valor);
  }
}

// Campo do formulário conforme o tipo — o "molde" de cada tipo mora aqui.
function campoHtml(campo, valor) {
  const req = campo.obrigatorio ? 'required' : '';
  const nome = escAttr(campo.chave);
  switch (campo.tipo) {
    case 'numero':
      return `<input name="${nome}" type="number" step="any" value="${valor ?? ''}" ${req} />`;
    case 'data':
      return `<input name="${nome}" type="date" value="${escAttr(valor ?? '')}" ${req} />`;
    case 'booleano':
      return `<label style="display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer">
        <input name="${nome}" type="checkbox" ${valor ? 'checked' : ''} /> Sim</label>`;
    case 'selecao':
      return `<select name="${nome}" ${req}>
        ${campo.obrigatorio ? '' : '<option value=""></option>'}
        ${campo.opcoes
          .map((o) => `<option value="${escAttr(o)}" ${o === valor ? 'selected' : ''}>${esc(o)}</option>`)
          .join('')}
      </select>`;
    default:
      return `<input name="${nome}" value="${escAttr(valor ?? '')}" ${req} />`;
  }
}

// Lê o valor do formulário já no TIPO certo (o servidor valida de novo).
function lerCampo(form, campo) {
  const el = form.querySelector(`[name="${CSS.escape(campo.chave)}"]`);
  if (!el) return null;
  if (campo.tipo === 'booleano') return el.checked;
  const bruto = el.value.trim();
  if (bruto === '') return campo.obrigatorio ? '' : null;
  if (campo.tipo === 'numero') return Number(bruto);
  return bruto;
}

export async function renderRecurso(el, ctx, { chave }) {
  const gestao = ctx.gestao;
  const estado = { busca: '', page: 1, recurso: null, registros: [] };

  async function carregar() {
    const qs = estado.busca ? `?busca=${encodeURIComponent(estado.busca)}` : '';
    const r = await api(`/r/${encodeURIComponent(chave)}${qs}`);
    estado.recurso = r.recurso;
    estado.registros = r.registros;
  }

  try {
    await carregar();
  } catch (err) {
    el.innerHTML = `<p class="empty" style="padding:24px 16px">Não consegui abrir esta página: ${esc(err.message)}</p>`;
    return;
  }

  const rec = estado.recurso;

  el.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px">
      <div>
        <h1 class="page-title">${esc(rec.nome)}</h1>
        <p class="page-sub" style="margin:4px 0 0">${estado.registros.length} registro(s)</p>
      </div>
      ${gestao ? `<button class="btn btn-primary novo-reg">${ico('add', { size: 18 })} Novo</button>` : ''}
    </div>

    <div class="panel">
      <div class="toolbar">
        <div class="search-inline">
          ${ico('search', { size: 19, color: '#8a94a0' })}
          <input id="r-busca" placeholder="Buscar em ${escAttr(rec.nome)}…" />
        </div>
      </div>
      <div id="r-tabela"></div>
      <div class="table-foot" id="r-foot"></div>
    </div>`;

  const elTabela = el.querySelector('#r-tabela');
  const elFoot = el.querySelector('#r-foot');

  function pintar() {
    const total = estado.registros.length;
    if (total === 0) {
      elTabela.innerHTML = '<p class="empty" style="padding:24px 16px">Nenhum registro ainda.</p>';
      elFoot.innerHTML = '';
      return;
    }
    const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (estado.page > paginas) estado.page = paginas;
    const ini = (estado.page - 1) * PAGE_SIZE;
    const pagina = estado.registros.slice(ini, ini + PAGE_SIZE);

    elTabela.innerHTML = `
      <table class="data-table">
        <thead><tr>
          ${rec.campos.map((c) => `<th>${esc(c.rotulo)}</th>`).join('')}
          ${gestao ? '<th></th>' : ''}
        </tr></thead>
        <tbody>
          ${pagina
            .map(
              (reg) => `<tr data-id="${reg.id}">
                ${rec.campos
                  .map(
                    (c, i) =>
                      `<td${c.tipo === 'numero' ? ' style="font-variant-numeric:tabular-nums"' : ''}${
                        i === 0 ? ' class="nome"' : ''
                      }>${esc(formatar(reg.valores[c.chave], c))}</td>`,
                  )
                  .join('')}
                ${
                  gestao
                    ? `<td><div class="row-actions">
                        <button class="row-btn edit" data-id="${reg.id}" title="Editar">${ico('edit', { size: 19 })}</button>
                        <button class="row-btn danger del" data-id="${reg.id}" title="Excluir">${ico('delete', {
                        size: 19,
                      })}</button>
                      </div></td>`
                    : ''
                }
              </tr>`,
            )
            .join('')}
        </tbody>
      </table>`;

    elFoot.innerHTML = `
      <span>${ini + 1}–${Math.min(ini + PAGE_SIZE, total)} de ${total}</span>
      <div class="pager">
        <button class="page-btn" ${estado.page <= 1 ? 'disabled' : ''} data-p="prev">${ico('chevron_left', { size: 18 })}</button>
        ${Array.from({ length: paginas }, (_, i) => i + 1)
          .map((n) => `<button class="page-btn ${n === estado.page ? 'is-active' : ''}" data-p="${n}">${n}</button>`)
          .join('')}
        <button class="page-btn" ${estado.page >= paginas ? 'disabled' : ''} data-p="next">${ico('chevron_right', { size: 18 })}</button>
      </div>`;

    elFoot.querySelectorAll('.page-btn').forEach((b) =>
      b.addEventListener('click', () => {
        const p = b.dataset.p;
        if (p === 'prev') estado.page--;
        else if (p === 'next') estado.page++;
        else estado.page = Number(p);
        pintar();
      }),
    );

    if (!gestao) return;
    elTabela.querySelectorAll('.edit').forEach((b) =>
      b.addEventListener('click', () => {
        const reg = estado.registros.find((x) => String(x.id) === b.dataset.id);
        if (reg) abrirDrawer(reg);
      }),
    );
    elTabela.querySelectorAll('.del').forEach((b) =>
      b.addEventListener('click', () => {
        const reg = estado.registros.find((x) => String(x.id) === b.dataset.id);
        if (reg) abrirExclusao(reg);
      }),
    );
  }

  async function recarregar() {
    await carregar();
    el.querySelector('.page-sub').textContent = `${estado.registros.length} registro(s)`;
    pintar();
  }

  let t;
  el.querySelector('#r-busca').addEventListener('input', (e) => {
    estado.busca = e.target.value.trim();
    clearTimeout(t);
    t = setTimeout(async () => {
      await carregar();
      estado.page = 1;
      pintar();
    }, 250);
  });
  el.querySelector('.novo-reg')?.addEventListener('click', () => abrirDrawer(null));

  function abrirDrawer(reg) {
    const edicao = Boolean(reg);
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="drawer" role="dialog" aria-modal="true">
        <div class="drawer-head">
          <div><h2>${edicao ? 'Editar' : 'Novo'} — ${esc(rec.nome)}</h2>
            <p>${edicao ? 'Atualize o registro' : 'Adicione um registro'}</p></div>
          <button class="drawer-close" title="Fechar">${ico('close', { size: 22 })}</button>
        </div>
        <div class="drawer-body">
          <form id="f-reg">
          ${rec.campos
            .map(
              (c) => `<div class="field">
                <label>${esc(c.rotulo)}${c.obrigatorio ? ' *' : ''}</label>
                ${campoHtml(c, reg ? reg.valores[c.chave] : null)}
              </div>`,
            )
            .join('')}
          </form>
        </div>
        <div class="drawer-foot">
          <div class="spacer"></div>
          <button class="btn btn-ghost cancelar">Cancelar</button>
          <button class="btn btn-primary salvar">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const fechar = () => ov.remove();
    ov.addEventListener('mousedown', (e) => {
      if (e.target === ov) fechar();
    });
    ov.querySelector('.drawer-close').addEventListener('click', fechar);
    ov.querySelector('.cancelar').addEventListener('click', fechar);

    ov.querySelector('.salvar').addEventListener('click', () => {
      const form = ov.querySelector('#f-reg');
      const corpo = {};
      for (const c of rec.campos) corpo[c.chave] = lerCampo(form, c);
      const faltando = rec.campos.find((c) => c.obrigatorio && (corpo[c.chave] === '' || corpo[c.chave] === null));
      if (faltando) {
        alert(`Preencha "${faltando.rotulo}".`);
        return;
      }
      acaoAdmin(ctx, async () => {
        const base = `/r/${encodeURIComponent(chave)}`;
        if (edicao) await api(`${base}/${reg.id}`, { method: 'PUT', body: JSON.stringify(corpo) });
        else await api(base, { method: 'POST', body: JSON.stringify(corpo) });
        fechar();
        await recarregar();
      });
    });
  }

  function abrirExclusao(reg) {
    const primeiro = rec.campos[0];
    const rotulo = formatar(reg.valores[primeiro?.chave], primeiro || { tipo: 'texto' });
    const ov = document.createElement('div');
    ov.className = 'overlay center';
    ov.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true">
        <div class="modal-icon">${ico('delete_forever', { size: 28 })}</div>
        <h3>Excluir registro?</h3>
        <p>Isto remove <strong style="color:var(--text)">${esc(rotulo)}</strong> de ${esc(rec.nome)}.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost cancelar">Cancelar</button>
          <button class="btn btn-danger confirmar">Excluir</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const fechar = () => ov.remove();
    ov.addEventListener('mousedown', (e) => {
      if (e.target === ov) fechar();
    });
    ov.querySelector('.cancelar').addEventListener('click', fechar);
    ov.querySelector('.confirmar').addEventListener('click', () =>
      acaoAdmin(ctx, async () => {
        await api(`/r/${encodeURIComponent(chave)}/${reg.id}`, { method: 'DELETE' });
        fechar();
        await recarregar();
      }),
    );
  }

  pintar();
}
