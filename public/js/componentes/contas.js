import { api } from '../core/api.js';
import { acaoAdmin } from '../core/dom.js';
import { avatar, esc, escAttr, ico } from '../core/ui.js';

// Contas de LOGIN (quem entra e gerencia o sistema) — não confundir com o
// diretório de Pessoas. Segue o drawer 3b do design: papel segmentado, senha
// com redefinir, "Conta ativa" e "Trocar senha no 1º acesso".

const PAPEIS = {
  admin: { label: 'Administrador', badge: 'setor' },
  gestor: { label: 'Gestor', badge: 'gestor' },
  viewer: { label: 'Somente leitura', badge: 'muted' },
};

export async function renderContas(el, ctx) {
  const contas = await api('/contas');
  const admins = contas.filter((c) => c.role === 'admin' && c.ativo).length;

  el.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px">
      <div>
        <h1 class="page-title">Contas de acesso</h1>
        <p class="page-sub" style="margin:4px 0 0">Quem pode entrar e gerenciar o sistema — ${contas.length} conta(s), ${admins} admin(s) ativa(s)</p>
      </div>
      <button class="btn btn-primary nova-conta">${ico('add', { size: 18 })} Nova conta</button>
    </div>
    <div class="panel">
      <table class="data-table">
        <thead><tr><th>Conta</th><th>E-mail</th><th>Papel</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${contas
            .map((c) => {
              const papel = PAPEIS[c.role] || PAPEIS.viewer;
              const eu = ctx.usuario && c.id === ctx.usuario.id;
              return `<tr data-id="${c.id}">
                <td><div class="cell-user">${avatar(c.name, { size: 34 })}
                  <div><div class="nome">${esc(c.name)}${eu ? ' <span style="font-size:11px;color:var(--muted-2)">(você)</span>' : ''}</div>
                  ${c.role === 'gestor' && c.setores?.length ? `<div style="font-size:12px;color:var(--muted-2)">${c.setores.join(', ')}</div>` : ''}${c.mustChangePassword ? '<div style="font-size:12px;color:var(--amber)">troca de senha pendente</div>' : ''}</div></div></td>
                <td style="color:var(--muted)">${esc(c.email)}</td>
                <td><span class="badge-role ${papel.badge}">${papel.label}</span></td>
                <td>${
                  c.ativo
                    ? '<span class="status ativo"><span class="dot"></span>Ativa</span>'
                    : '<span class="status inativo"><span class="dot"></span>Desativada</span>'
                }</td>
                <td><div class="row-actions">
                  <button class="row-btn edit" data-id="${c.id}" title="Editar">${ico('edit', { size: 19 })}</button>
                  ${eu ? '' : `<button class="row-btn danger del" data-id="${c.id}" title="Excluir">${ico('delete', { size: 19 })}</button>`}
                </div></td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;

  const recarregar = () => renderContas(el, ctx);
  el.querySelector('.nova-conta').addEventListener('click', () => abrirDrawer(null));
  el.querySelectorAll('.edit').forEach((b) =>
    b.addEventListener('click', () => {
      const c = contas.find((x) => String(x.id) === b.dataset.id);
      if (c) abrirDrawer(c);
    }),
  );
  el.querySelectorAll('.del').forEach((b) =>
    b.addEventListener('click', () => {
      const c = contas.find((x) => String(x.id) === b.dataset.id);
      if (c) abrirExclusao(c);
    }),
  );

  // ------------------------------------------------------------ drawer (3b)
  function abrirDrawer(c) {
    const edicao = Boolean(c);
    let role = c?.role || 'admin';
    let ativo = c ? c.ativo : true;
    const setoresSel = new Set(c?.setores ?? []);
    let trocar1 = edicao ? null : true; // criação: switch "trocar no 1º acesso"

    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="drawer" role="dialog" aria-modal="true">
        <div class="drawer-head">
          <div><h2>${edicao ? 'Editar conta' : 'Nova conta'}</h2>
            <p>${edicao ? 'Atualize os dados de acesso' : 'Crie um acesso de gestão ao sistema'}</p></div>
          <button class="drawer-close" title="Fechar">${ico('close', { size: 22 })}</button>
        </div>
        <div class="drawer-body">
          <div class="field"><label>Nome</label>
            <input name="name" placeholder="Nome de quem usa a conta" value="${c ? escAttr(c.name) : ''}" /></div>
          <div class="field"><label>E-mail (login)</label>
            <input name="email" placeholder="nome@seplag.local" value="${c ? escAttr(c.email) : ''}" />
            <div class="hint">Usado para entrar no sistema</div></div>
          <div class="field">
            <label>Papel de acesso</label>
            <div class="seg" style="grid-template-columns:1fr 1fr 1fr">
              <button type="button" class="seg-opt ${role === 'admin' ? 'is-on' : ''}" data-role="admin">Admin</button>
              <button type="button" class="seg-opt ${role === 'gestor' ? 'is-on' : ''}" data-role="gestor">Gestor</button>
              <button type="button" class="seg-opt ${role === 'viewer' ? 'is-on' : ''}" data-role="viewer">Leitura</button>
            </div>
            <div class="hint">Admin: tudo · Gestor: pessoas dos seus setores + próprios comunicados · Leitura: não escreve</div>
          </div>
          <div class="field" id="f-setores" style="display:${role === 'gestor' ? 'block' : 'none'}">
            <label>Setores do gestor</label>
            <div class="setores-chips">
              ${ctx.setores
                .map(
                  (d) => `<button type="button" class="chip-setor ${setoresSel.has(d.code) ? 'is-on' : ''}" data-code="${escAttr(
                    d.code,
                  )}">${esc(d.code)}</button>`,
                )
                .join('')}
            </div>
            <div class="hint">O gestor cadastra/edita apenas as pessoas destes setores</div>
          </div>
          ${
            edicao
              ? `<div class="field"><label>Senha</label>
                  <div style="display:flex;align-items:center;justify-content:space-between;border:1px solid var(--field-border);border-radius:8px;padding:10px 12px">
                    <span style="font-size:14px;color:var(--faint);letter-spacing:2px">••••••••••</span>
                    <button type="button" class="link-ver redefinir" style="font-size:13px">Redefinir</button>
                  </div>
                  <div class="hint">Ao redefinir, a pessoa troca a senha no próximo login</div></div>
                <div class="switch-row">
                  <div><div class="st">Conta ativa</div><div class="ss">Permite login imediato</div></div>
                  <button type="button" class="switch ${ativo ? 'is-on' : ''}" id="sw-ativo"></button>
                </div>`
              : `<div class="field"><label>Senha inicial</label>
                  <input name="senha" type="password" placeholder="mínimo 8 caracteres" autocomplete="new-password" /></div>
                <div class="switch-row">
                  <div><div class="st">Trocar senha no 1º acesso</div><div class="ss">Exige nova senha ao entrar</div></div>
                  <button type="button" class="switch is-on" id="sw-trocar1"></button>
                </div>`
          }
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
    ov.querySelectorAll('.seg-opt').forEach((b) =>
      b.addEventListener('click', () => {
        role = b.dataset.role;
        ov.querySelectorAll('.seg-opt').forEach((x) => x.classList.toggle('is-on', x === b));
        ov.querySelector('#f-setores').style.display = role === 'gestor' ? 'block' : 'none';
      }),
    );
    ov.querySelectorAll('.chip-setor').forEach((b) =>
      b.addEventListener('click', () => {
        const code = b.dataset.code;
        if (setoresSel.has(code)) setoresSel.delete(code);
        else setoresSel.add(code);
        b.classList.toggle('is-on', setoresSel.has(code));
      }),
    );
    ov.querySelector('#sw-ativo')?.addEventListener('click', (e) => {
      ativo = !ativo;
      e.currentTarget.classList.toggle('is-on', ativo);
    });
    ov.querySelector('#sw-trocar1')?.addEventListener('click', (e) => {
      trocar1 = !trocar1;
      e.currentTarget.classList.toggle('is-on', trocar1);
    });
    ov.querySelector('.redefinir')?.addEventListener('click', () => {
      const nova = prompt('Nova senha para esta conta (mínimo 8 caracteres):');
      if (!nova) return;
      acaoAdmin(ctx, async () => {
        await api(`/contas/${c.id}/senha`, { method: 'PUT', body: JSON.stringify({ senha: nova }) });
        alert('Senha redefinida. A pessoa trocará a senha no próximo login.');
      });
    });

    ov.querySelector('.salvar').addEventListener('click', () => {
      const val = (n) => ov.querySelector(`[name=${n}]`)?.value.trim() ?? '';
      const name = val('name');
      const email = val('email');
      if (!name || !email) {
        alert('Preencha nome e e-mail.');
        return;
      }
      if (role === 'gestor' && setoresSel.size === 0) {
        alert('Selecione pelo menos um setor para o gestor.');
        return;
      }
      const setores = role === 'gestor' ? [...setoresSel] : [];
      acaoAdmin(ctx, async () => {
        if (edicao) {
          await api(`/contas/${c.id}`, { method: 'PUT', body: JSON.stringify({ name, email, role, ativo, setores }) });
        } else {
          const senha = ov.querySelector('[name=senha]').value;
          await api('/contas', {
            method: 'POST',
            body: JSON.stringify({ name, email, senha, role, setores, mustChangePassword: trocar1 }),
          });
        }
        fechar();
        await recarregar();
      });
    });
  }

  // ----------------------------------------------- confirmação de exclusão
  function abrirExclusao(c) {
    const ov = document.createElement('div');
    ov.className = 'overlay center';
    ov.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true">
        <div class="modal-icon">${ico('delete_forever', { size: 28 })}</div>
        <h3>Excluir conta?</h3>
        <p>Esta ação removerá o acesso de <strong style="color:var(--text)">${esc(c.name)}</strong>
           (${esc(c.email)}) e não pode ser desfeita.</p>
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
        await api(`/contas/${c.id}`, { method: 'DELETE' });
        fechar();
        await recarregar();
      }),
    );
  }
}

// Formulário de troca da PRÓPRIA senha. Usado de dois jeitos:
//   • voluntário (botão na sidebar) — overlay com Cancelar;
//   • forçado (mustChangePassword no login) — sem Cancelar, bloqueia até trocar.
// `aoTrocar(respostaDaApi)` recebe {token, user} para o app renovar a sessão.
export function abrirTrocaDeSenha({ forcado = false, aoTrocar }) {
  const ov = document.createElement('div');
  ov.className = 'overlay center';
  ov.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="text-align:left">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        ${ico('key', { size: 22, color: 'var(--navy)' })}
        <h3 style="margin:0">${forcado ? 'Defina sua nova senha' : 'Trocar senha'}</h3>
      </div>
      <p style="text-align:left;margin-bottom:16px">${
        forcado ? 'Por segurança, troque a senha inicial antes de continuar.' : 'Informe a senha atual e a nova senha.'
      }</p>
      <div class="field" style="margin-bottom:12px"><label>Senha atual</label>
        <input name="senhaAtual" type="password" autocomplete="current-password" /></div>
      <div class="field" style="margin-bottom:12px"><label>Nova senha</label>
        <input name="novaSenha" type="password" autocomplete="new-password" placeholder="mínimo 8 caracteres" /></div>
      <div class="field" style="margin-bottom:18px"><label>Repetir a nova senha</label>
        <input name="repetir" type="password" autocomplete="new-password" /></div>
      <p class="login-error" style="display:none"></p>
      <div class="modal-actions">
        ${forcado ? '' : '<button class="btn btn-ghost cancelar">Cancelar</button>'}
        <button class="btn btn-primary confirmar">Salvar nova senha</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  const erroEl = ov.querySelector('.login-error');
  const mostrarErro = (m) => {
    erroEl.textContent = m;
    erroEl.style.display = 'block';
  };
  ov.querySelector('.cancelar')?.addEventListener('click', () => ov.remove());
  ov.querySelector('.confirmar').addEventListener('click', async () => {
    const v = (n) => ov.querySelector(`[name=${n}]`).value;
    if (v('novaSenha').length < 8) return mostrarErro('A nova senha precisa de pelo menos 8 caracteres.');
    if (v('novaSenha') !== v('repetir')) return mostrarErro('As senhas não conferem.');
    try {
      const r = await api('/auth/senha', {
        method: 'POST',
        body: JSON.stringify({ senhaAtual: v('senhaAtual'), novaSenha: v('novaSenha') }),
      });
      ov.remove();
      aoTrocar?.(r);
    } catch (e) {
      mostrarErro(e.message || 'falha ao trocar a senha');
    }
  });
}
