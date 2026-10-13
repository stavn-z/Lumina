import type { TemplateType, TextData } from "../types.ts";
import { esc, LINK_RE, linkMapOf, usedLinks, VAR_RE } from "./emailHtml.ts";

// SMS e WhatsApp: port de GSM/GSMX/smsInfo, txHtml, bubbleHtml, btnsHtml, btnsText,
// resolveFor e btnIssues do protótipo. O HTML gerado aqui é só para a prévia dentro do
// Lumina (balão de mensagem); as classes v-hl, l-hl, l-miss, wh-* são estilizadas pelo
// componente MessageBubble.

const GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSMX = '^{}\\[~]|€';

export function smsInfo(t: string) {
  let len = 0;
  for (const ch of t) {
    if (GSM.includes(ch)) len++;
    else if (GSMX.includes(ch)) len += 2;
    else { const L = t.length; return { gsm: false, len: L, seg: L <= 70 ? 1 : Math.ceil(L / 67) }; }
  }
  return { gsm: true, len, seg: len <= 160 ? 1 : Math.ceil(len / 153) };
}

function txMapOf(d: { vars?: { k: string, v: string }[] }) {
  const m: Record<string, string> = {};
  (d.vars || []).forEach(v => { const k = String(v.k || '').trim(); if (k) m[k] = v.v || ''; });
  return m;
}

export function resolveFor(d: TextData, s: string) {
  const m = txMapOf(d), lm = linkMapOf(d);
  return String(s || '').replace(VAR_RE, (x, k) => k in m ? m[k] : x).replace(LINK_RE, (x, k) => lm[k.toLowerCase()] || x);
}

export function txHtml(raw: string, type: TemplateType, d: TextData) {
  let h = esc(raw || '');
  if (type === 'whatsapp') h = h.replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|[\s>])_([^_\n]+)_/g, '$1<i>$2</i>').replace(/~([^~\n]+)~/g, '<s>$1</s>');
  const m = txMapOf(d), lm = linkMapOf(d);
  h = h.replace(VAR_RE, (x, k) => k in m ? '<span class="v-hl">' + esc(m[k]) + '</span>' : x);
  return h.replace(LINK_RE, (x, k) => { const u = lm[k.toLowerCase()]; return u ? '<span class="l-hl">' + esc(u) + '</span>' : '<span class="l-miss">' + x + '</span>'; });
}

export const BTN_T: Record<string, string> = { url: 'Link', phone: 'Telefone', reply: 'Resposta rápida' };
const BTN_ICO: Record<string, string> = {
  url: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.4 1.8.7 2.7a2 2 0 01-.5 2.1L8 9.8a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.7.7a2 2 0 011.7 2z"/></svg>',
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>',
};

export function btnsHtml(d: TextData) {
  if ((d.btnMode || 'cta') === 'none') return '';
  return (d.buttons || []).filter(b => b.text).map(b => '<span>' + (BTN_ICO[b.type] || '') + esc(b.text) + '</span>').join('');
}

const mdWpp = (h: string) => h.replace(/```([^`]+)```/g, '<code>$1</code>');

export function bubbleHtml(d: TextData, ty: TemplateType) {
  let h = '';
  if (ty === 'whatsapp') {
    const hd = d.header || ({} as TextData['header']);
    if (hd.type === 'media') {
      if (hd.mtype === 'image') h += '<div class="wh-media">' + (hd.src ? '<img alt="" src="' + esc(hd.src) + '">' : 'Imagem do cabeçalho') + '</div>';
      else if (hd.mtype === 'video') h += '<div class="wh-media video">▶ Vídeo do cabeçalho</div>';
      else h += '<div class="wh-media doc">📄 <span>' + esc(hd.upload || 'Documento.pdf') + '</span></div>';
    } else if (hd.type === 'text' && hd.text) h += '<div class="wh-h">' + txHtml(hd.text, ty, d) + '</div>';
  }
  h += mdWpp(txHtml(d.texto, ty, d));
  if (ty === 'whatsapp' && d.footer && d.footer.type === 'text' && d.footer.text) h += '<div class="wh-f">' + esc(d.footer.text) + '</div>';
  return h;
}

export function btnsText(d: TextData) {
  if ((d.btnMode || 'cta') === 'none') return '';
  return (d.buttons || []).filter(b => b.text).map(b => BTN_T[b.type] + ': ' + b.text + (b.type === 'reply' ? '' : ' → ' + resolveFor(d, b.value))).join('\n');
}

export const BTN_MAX: Record<string, number> = { cta: 2, reply: 3 };

export function btnIssues(d: TextData) {
  const bs = (d.btnMode === 'none' ? [] : (d.buttons || [])), out: string[] = [];
  if (d.btnMode === 'reply' && bs.length > 3) out.push('a Rubeus aceita até 3 respostas instantâneas');
  if (d.btnMode === 'cta' && bs.length > 2) out.push('a Rubeus aceita até 2 botões de CTA');
  if (bs.filter(b => b.type === 'phone').length > 1) out.push('o WhatsApp aceita no máximo 1 botão de telefone');
  if (bs.length > 10) out.push('o WhatsApp aceita no máximo 10 botões');
  if (bs.some(b => [...(b.text || '')].length > 25)) out.push('há título de botão com mais de 25 caracteres');
  const lm = linkMapOf(d);
  if (bs.some(b => b.type === 'url' && (!b.value || [...usedLinks(b.value)].some(k => !lm[k])))) out.push('há botão de link sem endereço');
  if (bs.some(b => b.type === 'phone' && !b.value)) out.push('há botão de telefone sem número');
  return out;
}
