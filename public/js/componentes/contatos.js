import { api } from '../core/api.js';
import { acaoAdmin, esc } from '../core/dom.js';

// Seção "Contatos": busca/filtra pessoas; admin adiciona, edita (inline) e remove.
// A busca do servidor já cobre nome, e-mail, setor e ramal.
export async function renderContatos(el, ctx) {
  el.innerHTML = `
    <div class="row">
      <h2>Contatos</h2>
      <div class="filtros">
        <input id="busca" placeholder="Buscar por nome, ramal, e-mail ou setor…" />
        <select id="filtro-setor">
          <option value="">Todos os setores</option>
          ${ctx.setores.map((d) => `<option value="${esc(d.code)}">${esc(d.code)}</option>`).join('')}
        </select>
      </div>
    </div>
    ${ctx.admin ? formNova(ctx) : ''}
    <div id="contatos-tabela">carregando…</div>`;

  const carregar = () => carregarTabela(el, ctx);
  el.querySelector('#busca').addEventListener('input', debounce(carregar, 250));
  el.querySelector('#filtro-setor').addEventListener('change', carregar);

  if (ctx.admin) {
    el.querySelector('#f-nova').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const num = (v) => (v ? Number(v) : null);
      acaoAdmin(ctx, async () => {
        await api('/pessoas', {
          method: 'POST',
          body: JSON.stringify({
            name: fd.get('name'),
            departmentCode: fd.get('departmentCode') || null,
            departmentFull: fd.get('departmentCode') || null,
            email: fd.get('email') || null,
            phoneExtension: fd.get('phoneExtension') || null,
            birthDay: num(fd.get('birthDay')),
            birthMonth: num(fd.get('birthMonth')),
          }),
        });
        e.target.reset();
        await carregar();
        await ctx.aoMudarPessoas?.();
      });
    });
  }

  await carregar();
}

async function carregarTabela(el, ctx) {
  const busca = el.querySelector('#busca')?.value.trim() ?? '';
  const setor = el.querySelector('#filtro-setor')?.value ?? '';
  const qs = new URLSearchParams();
  if (busca) qs.set('busca', busca);
  if (setor) qs.set('setor', setor);
  const itens = await api(`/pessoas?${qs.toString()}`);
  const tab = el.querySelector('#contatos-tabela');
  if (itens.length === 0) {
    tab.innerHTML = '<p class="vazio">Nenhuma pessoa encontrada.</p>';
    return;
  }
  tab.innerHTML = `
    <table>
      <thead><tr><th>Nome</th><th>Setor</th><th>Ramal</th><th>E-mail</th><th>Aniversário</th>${ctx.admin ? '<th></th>' : ''}</tr></thead>
      <tbody>
        ${itens
          .map(
            (p) => `<tr data-id="${p.id}">
              <td>${esc(p.name)}</td>
              <td>${esc(p.departmentFull || p.departmentCode || '')}</td>
              <td>${esc(p.phoneExtension || '')}</td>
              <td>${esc(p.email || '')}</td>
              <td>${p.birthDay && p.birthMonth ? `${p.birthDay}/${p.birthMonth}` : ''}</td>
              ${ctx.admin ? `<td class="acoes"><button class="link edit" data-id="${p.id}">editar</button> <button class="link del" data-id="${p.id}">remover</button></td>` : ''}
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>
    <p class="contagem">${itens.length} registro(s)</p>`;

  if (!ctx.admin) return;
  tab.querySelectorAll('.del').forEach((b) =>
    b.addEventListener('click', () => {
      if (!confirm('Remover esta pessoa?')) return;
      acaoAdmin(ctx, async () => {
        await api(`/pessoas/${b.dataset.id}`, { method: 'DELETE' });
        await carregarTabela(el, ctx);
        await ctx.aoMudarPessoas?.();
      });
    }),
  );
  tab.querySelectorAll('.edit').forEach((b) =>
    b.addEventListener('click', () => {
      const p = itens.find((x) => x.id === Number(b.dataset.id));
      if (p) editarLinha(el, ctx, p);
    }),
  );
}

function formNova(ctx) {
  return `
    <form id="f-nova" class="form-inline">
      <input name="name" placeholder="Nome" required />
      <input name="email" placeholder="E-mail" />
      <input name="phoneExtension" placeholder="Ramal" />
      <select name="departmentCode">
        <option value="">Setor…</option>
        ${ctx.setores.map((d) => `<option value="${esc(d.code)}">${esc(d.code)}</option>`).join('')}
      </select>
      <input name="birthDay" type="number" min="1" max="31" placeholder="Dia" />
      <input name="birthMonth" type="number" min="1" max="12" placeholder="Mês" />
      <button type="submit">Adicionar</button>
    </form>`;
}

function editarLinha(el, ctx, p) {
  const tr = el.querySelector(`#contatos-tabela tr[data-id="${p.id}"]`);
  if (!tr) return;
  tr.innerHTML = `
    <td><input name="name" required /></td>
    <td><select name="departmentCode"><option value="">Setor…</option>
      ${ctx.setores.map((d) => `<option value="${esc(d.code)}">${esc(d.code)}</option>`).join('')}</select></td>
    <td><input name="phoneExtension" class="curto" /></td>
    <td><input name="email" /></td>
    <td class="aniv"><input name="birthDay" type="number" min="1" max="31" class="curto" placeholder="Dia" />
        <input name="birthMonth" type="number" min="1" max="12" class="curto" placeholder="Mês" /></td>
    <td class="acoes"><button class="link salvar">salvar</button> <button class="link cancelar">cancelar</button></td>`;

  tr.querySelector('[name=name]').value = p.name;
  tr.querySelector('[name=departmentCode]').value = p.departmentCode || '';
  tr.querySelector('[name=phoneExtension]').value = p.phoneExtension || '';
  tr.querySelector('[name=email]').value = p.email || '';
  tr.querySelector('[name=birthDay]').value = p.birthDay ?? '';
  tr.querySelector('[name=birthMonth]').value = p.birthMonth ?? '';

  tr.querySelector('.cancelar').addEventListener('click', () => carregarTabela(el, ctx));
  tr.querySelector('.salvar').addEventListener('click', () => {
    const v = (n) => tr.querySelector(`[name=${n}]`).value.trim();
    const num = (n) => (v(n) ? Number(v(n)) : null);
    const patch = {
      name: v('name'),
      email: v('email') || null,
      phoneExtension: v('phoneExtension') || null,
      birthDay: num('birthDay'),
      birthMonth: num('birthMonth'),
    };
    const codigo = v('departmentCode') || null;
    if (codigo !== (p.departmentCode || null)) {
      patch.departmentCode = codigo;
      patch.departmentFull = codigo;
    }
    acaoAdmin(ctx, async () => {
      await api(`/pessoas/${p.id}`, { method: 'PUT', body: JSON.stringify(patch) });
      await carregarTabela(el, ctx);
      await ctx.aoMudarPessoas?.();
    });
  });
}

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
