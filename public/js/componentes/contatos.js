import { api, baixar } from '../core/api.js';
import { acaoAdmin } from '../core/dom.js';
import { avatar, esc, escAttr, ico, MESES_CURTOS } from '../core/ui.js';

const PAGE_SIZE = 8;

// Rótulo hierárquico de um setor: núcleos aparecem como "SECOGE / NSI".
const rotuloSetor = (d) => (d.parent ? `${d.parent} / ${d.code}` : d.code);
// Nome "extra" só quando acrescenta algo além da sigla (evita "SECOGE — SECOGE").
// Espelha fielmente o campo nome — não cai na descrição (que nem é editável),
// para quem trabalha só com siglas ver exatamente o que gravou.
const nomeSetor = (d) => (d.name && d.name !== d.code ? d.name : '');
// Ordena secretarias no topo, cada uma seguida dos seus núcleos.
const ordenarSetores = (lista) =>
  [...lista].sort((a, b) => {
    const ca = (a.parent || a.code).localeCompare(b.parent || b.code, 'pt');
    return ca !== 0 ? ca : (a.parent ? 1 : 0) - (b.parent ? 1 : 0) || a.code.localeCompare(b.code, 'pt');
  });
// Setores de uma pessoa (com retrocompatibilidade para o campo antigo).
const setoresDe = (p) => (p.setores && p.setores.length ? p.setores : p.departmentCode ? [p.departmentCode] : []);

// Console de pessoas/ramais. Serve as duas vistas do redesign:
//   • Ramais (público, somente leitura) — todo servidor consulta o diretório.
//   • Pessoas (admin/gestor) — CRUD (console 3a + drawer 3b + confirmação).
// A distinção é `manage`: no console de gestão aparecem ações, "Novo" e o drawer.
export async function renderPessoas(el, ctx, { manage = false } = {}) {
  const gestao = manage && ctx.gestao;
  // gestor só mexe nas pessoas dos SEUS setores (admin em todas)
  const podeSetor = (code) => ctx.admin || Boolean(code && (ctx.usuario?.setores ?? []).includes(code));
  // pessoa multi-setor: basta o gestor administrar UM dos setores dela
  const podeGerirPessoa = (p) => ctx.admin || setoresDe(p).some((c) => (ctx.usuario?.setores ?? []).includes(c));
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
        <h1 class="page-title">${gestao ? 'Pessoas' : 'Ramais'}</h1>
        <p class="page-sub" style="margin:4px 0 0">${
          gestao ? 'Diretório de servidores — cadastro, setores e aniversários' : 'Diretório de servidores, setores e ramais'
        }</p>
      </div>
      <div style="display:flex;gap:10px">
        ${ctx.usuario ? `<button class="btn btn-ghost exportar">${ico('download', { size: 18 })} Excel</button>` : ''}
        ${ctx.usuario ? `<button class="btn btn-ghost exportar-csv" title="Extração em CSV — abre no Excel e serve de auditoria">${ico('download', { size: 18 })} CSV</button>` : ''}
        ${ctx.admin ? `<button class="btn btn-ghost gerir-setores">${ico('apartment', { size: 18 })} Setores</button>` : ''}
        ${gestao ? `<button class="btn btn-primary novo-pessoa">${ico('add', { size: 18 })} Nova pessoa</button>` : ''}
      </div>
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
            ${ordenarSetores(ctx.setores)
              .map((d) => `<option value="${escAttr(d.code)}">${esc(rotuloSetor(d))}</option>`)
              .join('')}
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
    const setores = new Set();
    t.forEach((p) => setoresDe(p).forEach((c) => setores.add(c)));
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
          ${gestao ? '<th></th>' : ''}
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
                  setoresDe(p).length
                    ? setoresDe(p)
                        .map(
                          (c, i) =>
                            `<span class="badge-role setor" style="${
                              i > 0 ? 'opacity:.72;margin-left:4px' : ''
                            }">${esc(c)}</span>`,
                        )
                        .join('')
                    : p.departmentFull
                      ? `<span class="badge-role setor">${esc(p.departmentFull)}</span>`
                      : '<span style="color:var(--faint)">—</span>'
                }</td>
                <td>${esc(p.phoneExtension || '—')}</td>
                <td style="color:var(--muted)">${esc(p.email || '—')}</td>
                <td style="color:var(--muted)">${aniversario(p)}</td>
                <td>${st(p)}</td>
                ${
                  gestao
                    ? `<td>${
                        podeGerirPessoa(p)
                          ? `<div class="row-actions">
                              <button class="row-btn edit" data-id="${p.id}" title="Editar">${ico('edit', { size: 19 })}</button>
                              <button class="row-btn danger del" data-id="${p.id}" title="Excluir">${ico('delete', {
                              size: 19,
                            })}</button>
                            </div>`
                          : `<span style="font-size:11px;color:var(--faint)" title="Fora dos seus setores">—</span>`
                      }</td>`
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

    if (!gestao) return;
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
  el.querySelector('.gerir-setores')?.addEventListener('click', () => abrirSetores());
  // Excel (.xlsx, formatado) e CSV (extração crua para auditoria) — os dois
  // saem da MESMA vista filtrada que está na tela.
  const exportar = (seletor, caminho, nomePadrao) =>
    el.querySelector(seletor)?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const qs = new URLSearchParams();
      if (estado.busca) qs.set('busca', estado.busca);
      if (estado.setor) qs.set('setor', estado.setor);
      btn.disabled = true;
      try {
        await baixar(`${caminho}?${qs.toString()}`, nomePadrao);
      } catch (err) {
        alert(`Não consegui exportar: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    });
  exportar('.exportar', '/pessoas/export.xlsx', 'servidores-seplag.xlsx');
  exportar('.exportar-csv', '/exportar/pessoas.csv', 'pessoas.csv');

  // ------------------------------------------------------- gestão de setores
  // Drawer com a lista (sigla, nome, nº de pessoas), edição inline, exclusão
  // (bloqueada pelo servidor se houver pessoas) e formulário de criação.
  // Renomear a sigla cascateia para as pessoas — o servidor cuida disso.
  function abrirSetores() {
    let mudou = false;
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="drawer" role="dialog" aria-modal="true">
        <div class="drawer-head">
          <div><h2>Setores</h2><p>Siglas e nomes usados no diretório — renomear atualiza as pessoas</p></div>
          <button class="drawer-close" title="Fechar">${ico('close', { size: 22 })}</button>
        </div>
        <div class="drawer-body" id="setores-lista"></div>
        <div class="drawer-foot" style="flex-direction:column;align-items:stretch;gap:8px">
          <div class="lbl" style="font-size:12px;font-weight:600;color:var(--muted-2)">Novo setor</div>
          <div style="display:flex;gap:8px">
            <input name="ns-code" placeholder="SIGLA" maxlength="20" style="width:110px;border:1px solid var(--field-border);border-radius:8px;padding:9px 10px;font-size:13px;text-transform:uppercase" />
            <input name="ns-name" placeholder="Nome (opcional)" maxlength="255" style="flex:1;border:1px solid var(--field-border);border-radius:8px;padding:9px 10px;font-size:13px" />
            <button class="btn btn-primary btn-sm criar-setor">${ico('add', { size: 16 })} Criar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);

    const fechar = async () => {
      ov.remove();
      if (mudou) await ctx.recarregarSetores?.();
    };
    ov.addEventListener('mousedown', (e) => {
      if (e.target === ov) fechar();
    });
    ov.querySelector('.drawer-close').addEventListener('click', fechar);

    async function pintar() {
      const setores = await api('/setores');
      const porSetor = new Map();
      for (const p of estado.todas) {
        for (const c of setoresDe(p)) porSetor.set(c, (porSetor.get(c) ?? 0) + 1);
      }
      const lista = ov.querySelector('#setores-lista');
      lista.innerHTML = ordenarSetores(setores)
        .map((s) => {
          const n = porSetor.get(s.code) ?? 0;
          return `<div class="setor-row" data-id="${s.id}">
            <span class="badge-role setor">${esc(s.code)}</span>
            <div class="meta"><div class="t">${
              nomeSetor(s) ? esc(nomeSetor(s)) : '<span style="color:var(--faint)">só sigla</span>'
            }${
              s.parent ? ` <span style="color:var(--faint)">· núcleo de ${esc(s.parent)}</span>` : ''
            }</div><div class="s">${n} pessoa(s)</div></div>
            <button class="row-btn ed" data-id="${s.id}" title="Editar">${ico('edit', { size: 18 })}</button>
            <button class="row-btn mv" data-id="${s.id}" title="Mover/mesclar pessoas para outro setor">${ico('group', { size: 18 })}</button>
            <button class="row-btn danger del" data-id="${s.id}" title="${n > 0 ? 'Mova as pessoas antes de excluir' : 'Excluir'}">${ico(
              'delete',
              { size: 18 },
            )}</button>
          </div>`;
        })
        .join('');

      lista.querySelectorAll('.del').forEach((b) =>
        b.addEventListener('click', () => {
          const s = setores.find((x) => String(x.id) === b.dataset.id);
          if (!s || !confirm(`Excluir o setor ${s.code}?`)) return;
          acaoAdmin(ctx, async () => {
            await api(`/setores/${s.id}`, { method: 'DELETE' });
            mudou = true;
            await pintar();
          });
        }),
      );

      lista.querySelectorAll('.mv').forEach((b) =>
        b.addEventListener('click', () => {
          const s = setores.find((x) => String(x.id) === b.dataset.id);
          if (s) abrirMover(s, setores);
        }),
      );

      lista.querySelectorAll('.ed').forEach((b) =>
        b.addEventListener('click', () => {
          const s = setores.find((x) => String(x.id) === b.dataset.id);
          const row = lista.querySelector(`.setor-row[data-id="${s.id}"]`);
          row.innerHTML = `
            <input name="e-code" value="${escAttr(s.code)}" maxlength="20" style="width:100px;border:1px solid var(--field-border);border-radius:8px;padding:8px 9px;font-size:13px;text-transform:uppercase" />
            <input name="e-name" value="${escAttr(s.name === s.code ? '' : s.name)}" placeholder="Nome (opcional)" maxlength="255" style="flex:1;border:1px solid var(--field-border);border-radius:8px;padding:8px 9px;font-size:13px" />
            <button class="row-btn ok" title="Salvar">${ico('check', { size: 18 })}</button>
            <button class="row-btn cancel" title="Cancelar">${ico('close', { size: 18 })}</button>`;
          row.querySelector('.cancel').addEventListener('click', pintar);
          row.querySelector('.ok').addEventListener('click', () => {
            const code = row.querySelector('[name=e-code]').value.trim().toUpperCase();
            const name = row.querySelector('[name=e-name]').value.trim();
            // O nome é opcional (siglas-only); a sigla não. Sem sigla, DIZ o
            // motivo: um salvar que não faz nada e não explica é o pior dos
            // dois mundos — parece que o sistema perdeu a alteração.
            if (!code) {
              alert('A sigla não pode ficar em branco. O nome, sim — deixe vazio para o setor usar só a sigla.');
              return;
            }
            acaoAdmin(ctx, async () => {
              await api(`/setores/${s.id}`, { method: 'PUT', body: JSON.stringify({ code, name: name || code }) });
              mudou = true;
              await carregarTudoLocal();
              await pintar();
            });
          });
        }),
      );
    }

    // após renomear sigla, as pessoas mudam de código — recarrega a base local
    async function carregarTudoLocal() {
      estado.todas = await api('/pessoas');
      pintarStats();
      await buscar();
    }

    // Mover/mesclar: manda todas as pessoas de um setor para outro (e opcionalmente
    // exclui o setor de origem). Reaproveita a mesma cascata do renome, no servidor.
    function abrirMover(origem, setoresLista) {
      const n = estado.todas.filter((p) => setoresDe(p).includes(origem.code)).length;
      const destinos = ordenarSetores(setoresLista.filter((s) => s.code !== origem.code));
      const ov2 = document.createElement('div');
      ov2.className = 'overlay center';
      ov2.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" style="max-width:440px">
          <div class="modal-icon">${ico('group', { size: 26 })}</div>
          <h3>Mover pessoas de ${esc(origem.code)}</h3>
          <p>As <strong style="color:var(--text)">${n}</strong> pessoa(s) de <strong>${esc(origem.code)}</strong> passam para o setor escolhido.</p>
          <div class="field" style="text-align:left;margin-top:6px">
            <label>Setor de destino</label>
            <select name="destino" style="width:100%;border:1px solid var(--field-border);border-radius:10px;padding:9px 10px;font-size:13px">
              ${destinos.map((d) => `<option value="${escAttr(d.code)}">${esc(rotuloSetor(d))}</option>`).join('')}
            </select>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-top:10px;text-align:left;cursor:pointer">
            <input type="checkbox" name="excluir" /> Excluir o setor ${esc(origem.code)} depois de mover
          </label>
          <div class="modal-actions">
            <button class="btn btn-ghost cancelar">Cancelar</button>
            <button class="btn btn-primary confirmar" ${destinos.length ? '' : 'disabled'}>Mover</button>
          </div>
        </div>`;
      document.body.appendChild(ov2);
      const fechar2 = () => ov2.remove();
      ov2.addEventListener('mousedown', (e) => {
        if (e.target === ov2) fechar2();
      });
      ov2.querySelector('.cancelar').addEventListener('click', fechar2);
      ov2.querySelector('.confirmar').addEventListener('click', () => {
        const destino = ov2.querySelector('[name=destino]').value;
        const excluirOrigem = ov2.querySelector('[name=excluir]').checked;
        if (!destino) {
          alert('Escolha o setor de destino.');
          return;
        }
        acaoAdmin(ctx, async () => {
          const r = await api(`/setores/${origem.id}/mover`, {
            method: 'POST',
            body: JSON.stringify({ destino, excluirOrigem }),
          });
          fechar2();
          mudou = true;
          await carregarTudoLocal();
          await pintar();
          alert(`${r.movidas} pessoa(s) movida(s) para ${destino}${r.excluido ? ` — setor ${origem.code} excluído` : ''}.`);
        });
      });
    }

    ov.querySelector('.criar-setor').addEventListener('click', () => {
      const code = ov.querySelector('[name=ns-code]').value.trim().toUpperCase();
      const name = ov.querySelector('[name=ns-name]').value.trim();
      if (!code) {
        alert('Informe a sigla.');
        return;
      }
      acaoAdmin(ctx, async () => {
        await api('/setores', { method: 'POST', body: JSON.stringify({ code, name: name || code }) });
        ov.querySelector('[name=ns-code]').value = '';
        ov.querySelector('[name=ns-name]').value = '';
        mudou = true;
        await pintar();
      });
    });

    pintar();
  }

  // ------------------------------------------------------------- drawer (3b)
  function abrirDrawer(p) {
    const edicao = Boolean(p);
    let status = p?.status || 'ativo';
    // gestor: só os setores dele no select (e sem a opção "Sem setor")
    const setoresDrawer = ctx.admin ? ctx.setores : ctx.setores.filter((d) => podeSetor(d.code));
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
          <div class="field"><label>Setor principal</label>
            <select name="departmentCode">
              ${ctx.admin ? '<option value="">Sem setor</option>' : ''}
              ${ordenarSetores(setoresDrawer)
                .map(
                  (d) =>
                    `<option value="${escAttr(d.code)}" ${
                      p && p.departmentCode === d.code ? 'selected' : ''
                    }>${esc(rotuloSetor(d))}${nomeSetor(d) ? ` — ${esc(nomeSetor(d))}` : ''}</option>`,
                )
                .join('')}
            </select>
          </div>
          <div class="field"><label>Outros setores
            <span style="color:var(--faint);font-weight:400">— núcleos ou lotações adicionais (segure Ctrl/Cmd p/ marcar vários)</span></label>
            <select name="setoresExtras" multiple size="6"
              style="min-height:132px;padding:6px 8px;border:1px solid var(--field-border);border-radius:10px;font-size:13px">
              ${ordenarSetores(setoresDrawer)
                .map(
                  (d) =>
                    `<option value="${escAttr(d.code)}" ${
                      p && setoresDe(p).includes(d.code) && p.departmentCode !== d.code ? 'selected' : ''
                    }>${esc(rotuloSetor(d))}</option>`,
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
      const extras = [...ov.querySelectorAll('[name=setoresExtras] option:checked')].map((o) => o.value);
      const setores = [...new Set([code, ...extras].filter(Boolean))];
      // Mantém "SECOGE/NSI" no texto quando há exatamente um núcleo-filho do principal.
      const filhoUnico =
        extras.length === 1 && ctx.setores.some((d) => d.code === extras[0] && d.parent === code) ? extras[0] : null;
      const corpo = {
        name,
        cargo: val('cargo') || null,
        departmentCode: code,
        departmentFull: filhoUnico ? `${code}/${filhoUnico}` : code,
        setores,
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
