import { esc, escAttr } from './dom.js';

// Helpers de apresentação compartilhados pelos componentes da UI redesenhada.

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MESES_CURTOS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado',
];

// Ícone Material Symbols. `size` em px; `color` opcional.
export function ico(nome, { size = 20, color = null, cls = '' } = {}) {
  const style = [`font-size:${size}px`, color ? `color:${color}` : ''].filter(Boolean).join(';');
  return `<span class="ico ${cls}" style="${style}">${esc(nome)}</span>`;
}

// Iniciais para os avatares (até 2 letras).
export function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Paleta estável para avatares — deriva do nome, então é consistente entre telas.
const AVATARES = [
  { bg: '#fde8ef', fg: '#b23c6e' },
  { bg: '#e6f0fb', fg: '#1e73be' },
  { bg: '#e8f6ee', fg: '#1f8a52' },
  { bg: '#fdf0e6', fg: '#c46a12' },
  { bg: '#f0ecfb', fg: '#6b3fd1' },
  { bg: '#e3f4f5', fg: '#0f7a86' },
];
export function corAvatar(chave) {
  const s = String(chave || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATARES[h % AVATARES.length];
}

// Avatar circular com iniciais.
export function avatar(nome, { size = 34, cor = null } = {}) {
  const c = cor || corAvatar(nome);
  const fs = Math.round(size * 0.4);
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${fs}px;background:${c.bg};color:${c.fg}">${esc(
    iniciais(nome),
  )}</span>`;
}

// "Quinta-feira, 9 de julho"
export function dataLonga(d = new Date()) {
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
}

// Saudação conforme a hora.
export function saudacao(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Rótulo curto de data de criação de um aviso: "Hoje", "Ontem" ou "8 jul".
export function dataAviso(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoje = new Date();
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((dia(hoje) - dia(d)) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
}

// Marca do projeto: a imagem do perfil quando há logo, senão as iniciais.
// Usada na barra lateral e no login — os dois vêm de src/perfil.ts.
export function marcaHtml(perfil, cls = 'brand-mark') {
  if (perfil?.logo) {
    return `<img class="${escAttr(cls)}" src="${escAttr(perfil.logo)}" alt="${escAttr(
      perfil.titulo || perfil.nome || '',
    )}" style="object-fit:contain" />`;
  }
  return `<div class="${escAttr(cls)}">${esc(perfil?.marca || '·')}</div>`;
}

// Favicon desenhado a partir da marca — trocar o perfil troca o ícone da aba,
// sem precisar editar um arquivo .svg à parte. Se o perfil tiver logo, usa a
// própria imagem.
export function aplicarFavicon(perfil) {
  const link = document.querySelector('link[rel="icon"]') || document.createElement('link');
  link.rel = 'icon';
  if (perfil?.logo) {
    link.href = perfil.logo;
  } else {
    const cor = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#0b5cd6';
    const texto = (perfil?.marca || '·').slice(0, 3);
    const tamanho = texto.length > 2 ? 22 : 28;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="16" fill="${cor}"/>` +
      `<text x="32" y="43" text-anchor="middle" font-family="system-ui,sans-serif" ` +
      `font-size="${tamanho}" font-weight="700" fill="#fff">${esc(texto)}</text></svg>`;
    link.type = 'image/svg+xml';
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  if (!link.parentNode) document.head.appendChild(link);
}

export { esc, escAttr };
