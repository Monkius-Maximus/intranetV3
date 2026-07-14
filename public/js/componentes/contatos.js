import { api } from '../core/api.js';
import { acaoAdmin } from '../core/dom.js';
import { avatar, esc, escAttr, ico, MESES_CURTOS } from '../core/ui.js';

const PAGE_SIZE = 8;

// Console de pessoas/ramais. Serve as duas vistas do redesign:
//   • Ramais (público, somente leitura) — todo servidor consulta o diretório.
//   • Pessoas (admin) — CRUD completo (console 3a + drawer 3b + confirmação).
// A distinção é `manage`: no console do admin aparecem ações, "Novo" e o drawer.
export async function renderPessoas(el, ctx, { manage = false } = {}) {
  const admin = manage && ctx.admin;
  const estado = {
    busca: ctx.buscaInicial || '',
    setor: '',
    status: 'todos',
    page: 1,
    todas: [], // todas as pessoas (para os cartões de estatística)
    filtradas: [], // resultado da busca/filtro do servidor
  };
  ctx.buscaInicial = '';

  el.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px">
      <div>
        <h1 class="page-title">${admin ? 'Pessoas' : 'Ramais'}</h1>
        <p class="page-sub" style="margin:4px 0 0">${
          admin ? 'Diretório de servidores — cadastro, setores e aniversários' : 'Diretório de servidores, setores e ramais'
        }</p>
      </div>
      ${admin ? `<button class="btn btn-primary novo-pessoa">${ico('add', { size: 18 })} Nova pessoa</button>` : ''}
    </div>

    <div class="stats" id="p-stats"></div>

    <div class="panel">
      <div class="toolbar">
        <div class="search-inline">
          ${ico('search', { size: 19, color: '#8a94a0' })}
          <input id="p-busca" placeholder="Buscar por nome, ramal, e-mail ou setor…" value="${escAttr(estado.busca)}" />
        </div>
        <div class="filter-pill">
          ${ico('filter_list', { size: 18, color: '#8a94a0' })}
          <select id="p-setor">
            <option value="">Setor: Todos</option>
            ${ctx.setores.map((d) => `<option value="${escAttr(d.code)}">${esc(d.code)}</option>`).join('')}
          </select>
        </div>
        <div class="filter-pill">
          <select id="p-status">
            <option value="todos">Status: Todos</option>
            <option value="ativo">Ativos</option>
            <option value="ex">Inativos</option>
          </select>
        </div>
      </div>
      <div id="p-tabela"></div>
      <div class="table-foot" id="p-foot"></div>
    </div>`;

  const elStats = el.querySelector('#p-stats');
  const elTabela = el.querySelector('#p-tabela');
  const elFoot = el.querySelector('#p-foot');

  function pintarStats() {
    const t = estado.todas;
    const mes = new Date().getMonth() + 1;
    const setores = new Set(t.map((p) => p.departmentCode).filter(Boolean));
    const aniv = t.filter((p) => p.birthMonth === mes && p.birthDay).length;
    const ativos = t.filter((p) => (p.status || 'ativo') === 'ativo').length;
    const card = (icone, cor, rot, val) =>
      `<div class="stat"><div class="stat-label">${ico(icone, { size: 17, color: cor })}${esc(
        rot,
      )}</div><div class="stat-value">${val}</div></div>`;
    elStats.innerHTML =
      card('group', 'var(--navy)', 'Total', t.length) +
      card('cake', 'var(--pink)', 'Aniversariantes', aniv) +
      card('apartment', 'var(--brand)', 'Setores', setores.size) +
      card('bolt', 'var(--green)', 'Ativos', ativos);
  }

  function linhasVisiveis() {
    let rows = estado.filtradas;
    if (estado.status !== 'todos') rows = rows.filter((p) => (p.status || 'ativo') === estado.status);
    return rows;
  }

  function pintarTabela() {
    const rows = linhasVisiveis();
    const total = rows.length;
    const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (estado.page > paginas) estado.page = paginas;
    const ini = (estado.page - 1) * PAGE_SIZE;
    const pagina = rows.slice(ini, ini + PAGE_SIZE);

    if (total === 0) {
      elTabela.innerHTML = '<p class="empty" style="padding:24px 16px">Nenhuma pessoa encontrada.</p>';
      elFoot.innerHTML = '';
      return;
    }

    const aniversario = (p) =>
      p.birthDay && p.birthMonth ? `${String(p.birthDay).padStart(2, '0')} ${MESES_CURTOS[p.birthMonth - 1]}` : '—';
    const st = (p) => {
      const ex = (p.status || 'ativo') === 'ex';
      return `<span class="status ${ex ? 'inativo' : 'ativo'}"><span class="dot"></span>${ex ? 'Inativo' : 'Ativo'}</span>`;
    };

    elTabela.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Pessoa</th><th>Setor</th><th>Ramal</th><th>E-mail</th><th>Aniversário</th><th>Status</th>
          ${admin ? '<th></th>' : ''}
        </tr></thead>
        <tbody>
          ${pagina
            .map(
              (p) => `<tr data-id="${p.id}">
                <td><div class="cell-user">${avatar(p.name, { size: 34 })}
                  <div><div class="nome">${esc(p.name)}</div>${
                    p.cargo ? `<div style="font-size:12px;color:var(--muted-2)">${esc(p.cargo)}</div>` : ''
                  }</div></div></td>
                <td>${
                  p.departmentCode || p.departmentFull
                    ? `<span class="badge-role setor">${esc(p.departmentCode || p.departmentFull)}</span>`
                    : '<span style="color:var(--faint)">—</span>'
                }</td>
                <td>${esc(p.phoneExtension || '—')}</td>
                <td style="color:var(--muted)">${esc(p.email || '—')}</td>
                <td style="color:var(--muted)">${aniversario(p)}</td>
                <td>${st(p)}</td>
                ${
                  admin
                    ? `<td><div class="row-actions">
                        <button class="row-btn edit" data-id="${p.id}" title="Editar">${ico('edit', { size: 19 })}</button>
                        <button class="row-btn danger del" data-id="${p.id}" title="Excluir">${ico('delete', {
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
      <span>${ini + 1}–${Math.min(ini + PAGE_SIZE, total)} de ${total}${
        total === estado.todas.length ? '' : ` (${estado.todas.length} no total)`
      }</span>
      <div class="pager">
        <button class="page-btn" ${estado.page <= 1 ? 'disabled' : ''} data-p="prev">${ico('chevron_left', {
      size: 18,
    })}</button>
        ${Array.from({ length: paginas }, (_, i) => i + 1)
          .map((n) => `<button class="page-btn ${n === estado.page ? 'is-active' : ''}" data-p="${n}">${n}</button>`)
          .join('')}
        <button class="page-btn" ${estado.page >= paginas ? 'disabled' : ''} data-p="next">${ico('chevron_right', {
      size: 18,
    })}</button>
      </div>`;

    elFoot.querySelectorAll('.page-btn').forEach((b) =>
      b.addEventListener('click', () => {
        const p = b.dataset.p;
        if (p === 'prev') estado.page--;
        else if (p === 'next') estado.page++;
        else estado.page = Number(p);
        pintarTabela();
      }),
    );

    if (!admin) return;
    elTabela.querySelectorAll('.edit').forEach((b) =>
      b.addEventListener('click', () => {
        const p = estado.filtradas.find((x) => String(x.id) === b.dataset.id);
        if (p) abrirDrawer(p);
      }),
    );
    elTabela.querySelectorAll('.del').forEach((b) =>
      b.addEventListener('click', () => {
        const p = estado.filtradas.find((x) => String(x.id) === b.dataset.id);
        if (p) abrirExclusao(p);
      }),
    );
  }

  async function buscar() {
    const qs = new URLSearchParams();
    if (estado.busca) qs.set('busca', estado.busca);
    if (estado.setor) qs.set('setor', estado.setor);
    estado.filtradas = await api(`/pessoas?${qs.toString()}`);
    estado.page = 1;
    pintarTabela();
  }

  async function recarregarTudo() {
    estado.todas = await api('/pessoas');
    pintarStats();
    await buscar();
    ctx.aoMudarPessoas?.();
  }

  // filtros
  let t;
  el.querySelector('#p-busca').addEventListener('input', (e) => {
    estado.busca = e.target.value.trim();
    clearTimeout(t);
    t = setTimeout(buscar, 250);
  });
  el.querySelector('#p-setor').addEventListener('change', (e) => {
    estado.setor = e.target.value;
    buscar();
  });
  el.querySelector('#p-status').addEventListener('change', (e) => {
    estado.status = e.target.value;
    estado.page = 1;
    pintarTabela();
  });
  el.querySelector('.novo-pessoa')?.addEventListener('click', () => abrirDrawer(null));

  // ------------------------------------------------------------- drawer (3b)
  function abrirDrawer(p) {
    const edicao = Boolean(p);
    let status = p?.status || 'ativo';
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="drawer" role="dialog" aria-modal="true">
        <div class="drawer-head">
          <div><h2>${edicao ? 'Editar pessoa' : 'Nova pessoa'}</h2>
            <p>${edicao ? 'Atualize o cadastro do servidor' : 'Cadastre um novo servidor no diretório'}</p></div>
          <button class="drawer-close" title="Fechar">${ico('close', { size: 22 })}</button>
        </div>
        <div class="drawer-body">
          <div class="field"><label>Nome completo</label>
            <input name="name" placeholder="Nome do servidor" value="${p ? escAttr(p.name) : ''}" /></div>
          <div class="field"><label>Cargo</label>
            <input name="cargo" placeholder="Ex.: Analista de Gestão" value="${p ? escAttr(p.cargo || '') : ''}" /></div>
          <div class="field"><label>Setor</label>
            <select name="departmentCode">
              <option value="">Sem setor</option>
              ${ctx.setores
                .map(
                  (d) =>
                    `<option value="${escAttr(d.code)}" ${
                      p && p.departmentCode === d.code ? 'selected' : ''
                    }>${esc(d.code)} — ${esc(d.description || d.name)}</option>`,
                )
                .join('')}
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field"><label>Ramal</label>
              <input name="phoneExtension" placeholder="0000" value="${p ? escAttr(p.phoneExtension || '') : ''}" /></div>
            <div class="field"><label>E-mail</label>
              <input name="email" placeholder="nome@seplag.pe.gov.br" value="${p ? escAttr(p.email || '') : ''}" /></div>
          </div>
          <div class="field">
            <label>Aniversário</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <input name="birthDay" type="number" min="1" max="31" placeholder="Dia" value="${p?.birthDay ?? ''}" />
              <input name="birthMonth" type="number" min="1" max="12" placeholder="Mês" value="${p?.birthMonth ?? ''}" />
            </div>
          </div>
          <div class="field">
            <label>Situação</label>
            <div class="seg">
              <button type="button" class="seg-opt ${status === 'ativo' ? 'is-on' : ''}" data-status="ativo">Ativo</button>
              <button type="button" class="seg-opt ${status === 'ex' ? 'is-on' : ''}" data-status="ex">Ex-servidor</button>
            </div>
            <div class="hint">Ex-servidores permanecem no histórico, mas fora do diretório ativo.</div>
          </div>
        </div>
        <div class="drawer-foot">
          ${
            edicao
              ? `<button class="btn-danger-link excluir">${ico('delete', { size: 18 })} Excluir</button>`
              : ''
          }
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
    ov.querySelectorAll('.seg-opt').forEach((b) =>
      b.addEventListener('click', () => {
        status = b.dataset.status;
        ov.querySelectorAll('.seg-opt').forEach((x) => x.classList.toggle('is-on', x === b));
      }),
    );
    ov.querySelector('.excluir')?.addEventListener('click', () => {
      fechar();
      abrirExclusao(p);
    });

    ov.querySelector('.salvar').addEventListener('click', () => {
      const val = (n) => ov.querySelector(`[name=${n}]`).value.trim();
      const num = (n) => (val(n) ? Number(val(n)) : null);
      const name = val('name');
      if (!name) {
        alert('Informe o nome completo.');
        return;
      }
      const code = val('departmentCode') || null;
      const corpo = {
        name,
        cargo: val('cargo') || null,
        departmentCode: code,
        departmentFull: code,
        email: val('email') || null,
        phoneExtension: val('phoneExtension') || null,
        birthDay: num('birthDay'),
        birthMonth: num('birthMonth'),
        status,
      };
      acaoAdmin(ctx, async () => {
        if (edicao) await api(`/pessoas/${p.id}`, { method: 'PUT', body: JSON.stringify(corpo) });
        else await api('/pessoas', { method: 'POST', body: JSON.stringify(corpo) });
        fechar();
        await recarregarTudo();
      });
    });
  }

  // ----------------------------------------------- confirmação de exclusão
  function abrirExclusao(p) {
    const ov = document.createElement('div');
    ov.className = 'overlay center';
    ov.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true">
        <div class="modal-icon">${ico('delete_forever', { size: 28 })}</div>
        <h3>Excluir pessoa?</h3>
        <p>Esta ação removerá permanentemente <strong style="color:var(--text)">${esc(
          p.name,
        )}</strong> e não pode ser desfeita.</p>
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
        await api(`/pessoas/${p.id}`, { method: 'DELETE' });
        fechar();
        await recarregarTudo();
      }),
    );
  }

  // primeira carga
  estado.todas = await api('/pessoas');
  pintarStats();
  await buscar();
}
