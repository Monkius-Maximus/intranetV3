import { api } from '../core/api.js';
import { acaoAdmin } from '../core/dom.js';
import { esc, escAttr, ico } from '../core/ui.js';

// "Páginas" — o CRUD das PÁGINAS do sistema (recursos dirigidos por dados).
// Aqui o admin cria uma lista nova (Estoque, Gastos, Tarefas) escolhendo os
// campos; a página passa a existir no menu e na API sem ninguém programar.

const TIPOS = [
  { v: 'texto', r: 'Texto' },
  { v: 'numero', r: 'Número' },
  { v: 'data', r: 'Data' },
  { v: 'booleano', r: 'Sim/Não' },
  { v: 'selecao', r: 'Seleção' },
];

// Sugere a chave técnica a partir do rótulo ("Quantidade em casa" -> "quantidade_em_casa").
function sugerirChave(texto) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, 'c$1')
    .slice(0, 30);
}

export async function renderPaginas(el, ctx) {
  let icones = ['folder_open'];
  try {
    ({ icones } = await api('/tiles/opcoes'));
  } catch {
    /* mantém o padrão */
  }

  async function carregar() {
    return api('/recursos');
  }

  async function pintar() {
    const recursos = await carregar();
    el.innerHTML = `
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px">
        <div>
          <h1 class="page-title">Páginas</h1>
          <p class="page-sub" style="margin:4px 0 0">Listas criadas pela tela — aparecem no menu e na API</p>
        </div>
        <button class="btn btn-primary nova-pagina">${ico('add', { size: 18 })} Nova página</button>
      </div>

      <div class="panel">
        ${
          recursos.length === 0
            ? `<p class="empty" style="padding:24px 16px">Nenhuma página criada ainda. Comece por "Nova página" —
                 por exemplo <em>Estoque</em> com os campos Item, Quantidade e Mínimo.</p>`
            : `<table class="data-table">
                <thead><tr><th>Página</th><th>Endereço</th><th>Campos</th><th></th></tr></thead>
                <tbody>
                  ${recursos
                    .map(
                      (r) => `<tr data-id="${r.id}">
                        <td><div class="cell-user">${ico(r.icone, { size: 20 })}
                          <div class="nome" style="margin-left:8px">${esc(r.nome)}</div></div></td>
                        <td style="color:var(--muted)"><code>/api/r/${esc(r.chave)}</code></td>
                        <td style="color:var(--muted)">${r.campos.map((c) => esc(c.rotulo)).join(', ')}</td>
                        <td><div class="row-actions">
                          <button class="row-btn edit" data-id="${r.id}" title="Editar">${ico('edit', { size: 19 })}</button>
                          <button class="row-btn danger del" data-id="${r.id}" title="Excluir">${ico('delete', {
                        size: 19,
                      })}</button>
                        </div></td>
                      </tr>`,
                    )
                    .join('')}
                </tbody>
              </table>`
        }
      </div>`;

    el.querySelector('.nova-pagina').addEventListener('click', () => abrirEditor(null));
    el.querySelectorAll('.edit').forEach((b) =>
      b.addEventListener('click', () => abrirEditor(recursos.find((x) => String(x.id) === b.dataset.id))),
    );
    el.querySelectorAll('.del').forEach((b) =>
      b.addEventListener('click', () => abrirExclusao(recursos.find((x) => String(x.id) === b.dataset.id))),
    );
  }

  // ------------------------------------------------------------ editor
  function abrirEditor(recurso) {
    const edicao = Boolean(recurso);
    // Cópia de trabalho: só vai para o servidor ao salvar.
    const campos = recurso
      ? recurso.campos.map((c) => ({ ...c, opcoes: [...(c.opcoes || [])] }))
      : [{ chave: '', rotulo: '', tipo: 'texto', obrigatorio: true, opcoes: [] }];

    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="drawer" role="dialog" aria-modal="true">
        <div class="drawer-head">
          <div><h2>${edicao ? 'Editar página' : 'Nova página'}</h2>
            <p>${edicao ? 'O endereço não muda: os registros dependem dele' : 'Defina o nome e os campos da lista'}</p></div>
          <button class="drawer-close" title="Fechar">${ico('close', { size: 22 })}</button>
        </div>
        <div class="drawer-body">
          <div class="field"><label>Nome da página</label>
            <input name="nome" placeholder="Ex.: Estoque" maxlength="40" value="${escAttr(recurso?.nome || '')}" /></div>
          <div class="field"><label>Endereço técnico ${edicao ? '(fixo)' : '(gerado do nome)'}</label>
            <input name="chave" placeholder="estoque" maxlength="30" value="${escAttr(recurso?.chave || '')}" ${
              edicao ? 'disabled' : ''
            } /></div>
          <div class="field"><label>Ícone no menu</label>
            <select name="icone">
              ${icones
                .map((i) => `<option value="${escAttr(i)}" ${i === recurso?.icone ? 'selected' : ''}>${esc(i)}</option>`)
                .join('')}
            </select></div>

          <div class="field" style="margin-top:8px">
            <label>Campos <span style="color:var(--faint);font-weight:400">— o que cada registro guarda</span></label>
            <div id="lista-campos" style="display:flex;flex-direction:column;gap:10px"></div>
            <button type="button" class="btn btn-ghost btn-sm add-campo" style="margin-top:10px">
              ${ico('add', { size: 16 })} Adicionar campo</button>
          </div>
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

    const elNome = ov.querySelector('[name=nome]');
    const elChave = ov.querySelector('[name=chave]');
    if (!edicao) {
      elNome.addEventListener('input', () => {
        elChave.value = sugerirChave(elNome.value);
      });
    }

    const lista = ov.querySelector('#lista-campos');
    function pintarCampos() {
      lista.innerHTML = campos
        .map(
          (c, i) => `
          <div class="setor-row" data-i="${i}" style="align-items:flex-start;flex-wrap:wrap;gap:8px">
            <input class="c-rotulo" data-i="${i}" placeholder="Rótulo (ex.: Quantidade)" maxlength="60"
              value="${escAttr(c.rotulo)}" style="flex:1;min-width:150px;border:1px solid var(--field-border);border-radius:8px;padding:8px 9px;font-size:13px" />
            <select class="c-tipo" data-i="${i}" style="width:120px;border:1px solid var(--field-border);border-radius:8px;padding:8px 9px;font-size:13px">
              ${TIPOS.map((t) => `<option value="${t.v}" ${t.v === c.tipo ? 'selected' : ''}>${t.r}</option>`).join('')}
            </select>
            <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted-2);white-space:nowrap">
              <input type="checkbox" class="c-obrig" data-i="${i}" ${c.obrigatorio ? 'checked' : ''} /> obrigatório</label>
            <button type="button" class="row-btn danger c-del" data-i="${i}" title="Remover campo">${ico('delete', {
              size: 17,
            })}</button>
            ${
              c.tipo === 'selecao'
                ? `<input class="c-opcoes" data-i="${i}" placeholder="Opções separadas por vírgula (ex.: un, L, kg)"
                     value="${escAttr(c.opcoes.join(', '))}"
                     style="flex-basis:100%;border:1px solid var(--field-border);border-radius:8px;padding:8px 9px;font-size:13px" />`
                : ''
            }
          </div>`,
        )
        .join('');

      lista.querySelectorAll('.c-rotulo').forEach((i) =>
        i.addEventListener('input', () => {
          const c = campos[Number(i.dataset.i)];
          c.rotulo = i.value;
          if (!c.travada) c.chave = sugerirChave(i.value); // chave acompanha o rótulo
        }),
      );
      lista.querySelectorAll('.c-tipo').forEach((s) =>
        s.addEventListener('change', () => {
          campos[Number(s.dataset.i)].tipo = s.value;
          pintarCampos(); // mostra/esconde a linha de opções
        }),
      );
      lista.querySelectorAll('.c-obrig').forEach((c) =>
        c.addEventListener('change', () => {
          campos[Number(c.dataset.i)].obrigatorio = c.checked;
        }),
      );
      lista.querySelectorAll('.c-opcoes').forEach((i) =>
        i.addEventListener('input', () => {
          campos[Number(i.dataset.i)].opcoes = i.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }),
      );
      lista.querySelectorAll('.c-del').forEach((b) =>
        b.addEventListener('click', () => {
          if (campos.length === 1) {
            alert('A página precisa de pelo menos um campo.');
            return;
          }
          campos.splice(Number(b.dataset.i), 1);
          pintarCampos();
        }),
      );
    }
    pintarCampos();

    ov.querySelector('.add-campo').addEventListener('click', () => {
      campos.push({ chave: '', rotulo: '', tipo: 'texto', obrigatorio: false, opcoes: [] });
      pintarCampos();
    });

    ov.querySelector('.salvar').addEventListener('click', () => {
      const nome = elNome.value.trim();
      const chave = (edicao ? recurso.chave : elChave.value.trim()) || sugerirChave(nome);
      if (!nome) {
        alert('Informe o nome da página.');
        return;
      }
      const limpos = campos
        .map((c) => ({
          chave: c.chave || sugerirChave(c.rotulo),
          rotulo: c.rotulo.trim(),
          tipo: c.tipo,
          obrigatorio: Boolean(c.obrigatorio),
          opcoes: c.tipo === 'selecao' ? c.opcoes : [],
        }))
        .filter((c) => c.rotulo);
      if (limpos.length === 0) {
        alert('Defina pelo menos um campo com rótulo.');
        return;
      }
      const semOpcao = limpos.find((c) => c.tipo === 'selecao' && c.opcoes.length === 0);
      if (semOpcao) {
        alert(`O campo "${semOpcao.rotulo}" é de seleção: informe as opções.`);
        return;
      }
      acaoAdmin(ctx, async () => {
        const corpo = { nome, icone: ov.querySelector('[name=icone]').value, campos: limpos };
        if (edicao) await api(`/recursos/${recurso.id}`, { method: 'PUT', body: JSON.stringify(corpo) });
        else await api('/recursos', { method: 'POST', body: JSON.stringify({ ...corpo, chave }) });
        fechar();
        await ctx.recarregarRecursos?.();
        await pintar();
      });
    });
  }

  // --------------------------------------------------------- exclusão
  function abrirExclusao(recurso) {
    const ov = document.createElement('div');
    ov.className = 'overlay center';
    ov.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true">
        <div class="modal-icon">${ico('delete_forever', { size: 28 })}</div>
        <h3>Excluir a página ${esc(recurso.nome)}?</h3>
        <p>Isto remove a página <strong style="color:var(--text)">e todos os registros dela</strong>.
           Esta ação não pode ser desfeita.</p>
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
        const r = await api(`/recursos/${recurso.id}`, { method: 'DELETE' });
        fechar();
        await ctx.recarregarRecursos?.();
        await pintar();
        if (r.registrosRemovidos) alert(`Página excluída (${r.registrosRemovidos} registro(s) removidos).`);
      }),
    );
  }

  await pintar();
}
