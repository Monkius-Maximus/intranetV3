const TOKEN_KEY = 'intranet_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class NaoAutenticado extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'NaoAutenticado';
  }
}

// Cliente HTTP único. Leitura é pública; ações de admin mandam o token.
export async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  // FormData (upload) define o próprio Content-Type (multipart + boundary).
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    throw new NaoAutenticado('sessão expirada');
  }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    let msg = b.erro || `erro ${res.status}`;
    // Zod: torna a validação acionável ("campo: problema") em vez de genérica.
    if (Array.isArray(b.detalhes) && b.detalhes.length > 0) {
      const itens = b.detalhes.slice(0, 2).map((d) => `${(d.path || []).join('.') || 'corpo'}: ${d.message}`);
      msg += ` — ${itens.join('; ')}`;
    }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

// Baixa um arquivo binário da API (ex.: exportação .xlsx) mandando o token e
// disparando o download no navegador. Fora do api() porque a resposta é um
// blob, não JSON.
export async function baixar(path, nomeArquivo) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { headers });
  if (res.status === 401) {
    clearToken();
    throw new NaoAutenticado('sessão expirada');
  }
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.erro || `erro ${res.status}`);
  }

  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename="?([^"]+)"?/.exec(cd);
  const nome = (m && m[1]) || nomeArquivo || 'download';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
