// Escapa para conteúdo de texto (contra XSS ao usar innerHTML).
export function esc(v) {
  const d = document.createElement('div');
  d.textContent = v == null ? '' : String(v);
  return d.innerHTML;
}

// Escapa para uso dentro de atributos entre aspas duplas.
export function escAttr(v) {
  return esc(v).replace(/"/g, '&quot;');
}

// Executa uma ação de admin tratando expiração de sessão e erros.
export async function acaoAdmin(ctx, fn) {
  try {
    await fn();
  } catch (e) {
    if (e && e.name === 'NaoAutenticado') ctx.sair();
    else alert(e.message || 'falha na operação');
  }
}
