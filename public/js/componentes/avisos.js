import { api } from '../core/api.js';
import { acaoAdmin, esc } from '../core/dom.js';

export async function renderAvisos(el, ctx) {
  const itens = await api('/avisos');
  el.innerHTML = `
    <h2>Comunicados</h2>
    <div class="lista-avisos">
      ${
        itens.length === 0
          ? '<p class="vazio">Nenhum comunicado.</p>'
          : itens
              .map(
                (a) => `<article class="aviso">
                  <h3>${a.pinned ? '📌 ' : ''}${esc(a.title)}</h3>
                  <p>${esc(a.body)}</p>
                  ${ctx.admin ? `<button class="link del-aviso" data-id="${a.id}">remover</button>` : ''}
                </article>`,
              )
              .join('')
      }
    </div>
    ${
      ctx.admin
        ? `<form class="form-inline" id="f-aviso">
             <input name="title" placeholder="Título" required />
             <input name="body" placeholder="Mensagem" required />
             <label class="chk"><input name="pinned" type="checkbox" /> fixar</label>
             <button type="submit">Publicar</button>
           </form>`
        : ''
    }`;

  if (!ctx.admin) return;

  el.querySelectorAll('.del-aviso').forEach((b) =>
    b.addEventListener('click', () =>
      acaoAdmin(ctx, async () => {
        await api(`/avisos/${b.dataset.id}`, { method: 'DELETE' });
        await renderAvisos(el, ctx);
      }),
    ),
  );

  el.querySelector('#f-aviso').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    acaoAdmin(ctx, async () => {
      await api('/avisos', {
        method: 'POST',
        body: JSON.stringify({ title: fd.get('title'), body: fd.get('body'), pinned: fd.get('pinned') === 'on' }),
      });
      await renderAvisos(el, ctx);
    });
  });
}
