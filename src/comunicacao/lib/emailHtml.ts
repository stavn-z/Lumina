import type { EmailData, EmailImage, SocialItem } from "../types.ts";

// Geração do HTML do e-mail: port literal das funções do protótipo
// (docs/gerador-email.html: esc, varMap, linkMapOf, applyLinks, applyVars, placeholder,
// fmtInline, socialRow, fmtText, upperKeepVars, imgRow e generate). A única diferença é
// que o estado `S` e a opção "Destacar variáveis" chegam como parâmetro, em vez de virem
// de variáveis globais e do DOM. Para o mesmo template, a saída tem de ser idêntica à do
// protótipo — conferido por scripts/verificar-email-html.mjs. NÃO "melhorar" as strings.

type S = EmailData;

export const esc = (s: unknown) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const VAR_RE = /\{(\w+)\}/g;
export const RESERVED = ['view', 'unsubscribe'];
export const LINK_RE = /\[(link\d*)\](?!\()/gi;

export function varMap(S: { vars?: { k: string, v: string }[] }) {
  const m: Record<string, string> = {};
  (S.vars || []).forEach(v => { const k = String(v.k || '').trim(); if (k) m[k] = v.v || ''; });
  return m;
}

export function linkMapOf(d: { links?: { k: string, v: string }[] } | null | undefined) {
  const m: Record<string, string> = {};
  ((d && d.links) || []).forEach(l => { const k = String(l.k || '').trim().toLowerCase(); if (k) m[k] = String(l.v || '').trim(); });
  return m;
}

export function usedLinks(txt: string) {
  const out = new Set<string>();
  String(txt || '').replace(/\[(link\d*)\](?!\()/gi, (x, k) => { out.add(k.toLowerCase()); return x; }).replace(/\]\((link\d*)\)/gi, (x, k) => { out.add(k.toLowerCase()); return x; });
  return out;
}

export function applyLinks(html: string, color: string, S: S) {
  const m = linkMapOf(S);
  return html.split(/(<[^>]*>)/).map(p => {
    if (p.startsWith('<')) return p.replace(/\[(link\d*)\]/gi, (x, k) => m[k.toLowerCase()] ? esc(m[k.toLowerCase()]) : x);
    return p.replace(LINK_RE, (x, k) => { const u = m[k.toLowerCase()]; return u ? '<a href="' + esc(u) + '" target="_blank" style="color:' + color + ';text-decoration:underline;word-break:break-all;">' + esc(u) + '</a>' : x; });
  }).join('');
}

export const resolve = (s: string, S: S) => { const m = varMap(S); return String(s || '').replace(VAR_RE, (x, k) => k in m ? m[k] : x); };

export function usedVars(S: S) {
  const src = [S.texto, S.btn.text, S.btn.link, S.preheader, S.assunto, S.banner.link, S.footer.link, S.webview.url, S.banner.alt, S.footer.alt, S.social && S.social.on ? [S.social.contato, S.social.unsub ? S.social.unsubText : '', ...(S.social.items || []).map(i => i.link)].join(' ') : ''].join(' ');
  const out = new Set<string>(); let m: RegExpExecArray | null; VAR_RE.lastIndex = 0; while ((m = VAR_RE.exec(src))) if (!RESERVED.includes(m[1])) out.add(m[1]); return out;
}

export function applyVars(html: string, hl: boolean, S: S) {
  const map = varMap(S);
  const rep = (s: string, inTag: boolean) => s.replace(VAR_RE, (m, k) => {
    if (!(k in map)) return m;
    return (hl && !inTag) ? '<span style="background:#fff1a8;border-radius:3px;box-shadow:0 0 0 2px #fff1a8;">' + map[k] + '</span>' : map[k];
  });
  return html.split(/(<[^>]*>)/).map(p => p.startsWith('<') ? rep(p, true) : rep(p, false)).join('');
}

export function placeholder(w: number, h: number, label: string) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><rect width="100%" height="100%" fill="#e4e4e7"/><rect x="1" y="1" width="' + (w - 2) + '" height="' + (h - 2) + '" fill="none" stroke="#a1a1aa" stroke-dasharray="6 6"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="16" fill="#52525b">' + label + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export const NETS: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X (Twitter)', pinterest: 'Pinterest', tiktok: 'TikTok', whatsapp: 'WhatsApp', site: 'Site' };
export const MC: Record<string, string> = { instagram: 'instagram', facebook: 'facebook', youtube: 'youtube', linkedin: 'linkedin', x: 'twitter', pinterest: 'pinterest' };
export const builtinIcon = (rede: string, style: string) => MC[rede] ? 'https://cdn-images.mailchimp.com/icons/social-block-v2/' + (style || 'light') + '-' + MC[rede] + '-96.png' : '';
export const iconOf = (it: SocialItem, so: { iconStyle: string }) => it.icon || builtinIcon(it.rede, so.iconStyle);

function fmtInline(raw: string, color: string, S: S) {
  let h = esc(raw);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => { const lu = linkMapOf(S)[u.toLowerCase()]; return '<a href="' + (lu ? esc(lu) : u) + '" target="_blank" style="color:' + color + ';text-decoration:underline;">' + t + '</a>'; });
  return h;
}

function socialRow(font: string, S: S) {
  const so = S.social; if (!so || !so.on) return '';
  const bg = esc(so.bg), col = esc(so.color), sz = parseInt(so.size, 10) || 30;
  let h = '<tr>\n<td bgcolor="' + bg + '" style="background-color:' + bg + ';padding:0;">\n';
  if (so.accent) h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="5" bgcolor="' + esc(so.accent) + '" style="height:5px;background-color:' + esc(so.accent) + ';font-size:0;line-height:0;">&nbsp;</td></tr></table>\n';
  h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" class="px" style="padding:16px 20px 18px 20px;font-family:' + font + ';color:' + col + ';">\n';
  const items = (so.items || []).filter(i => i.link || iconOf(i, so));
  if (items.length) {
    h += '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr>\n';
    items.forEach(it => {
      const name = NETS[it.rede] || 'Link'; const href = esc(it.link || '#');
      const icn = iconOf(it, so);
      const inner = icn ? '<img src="' + esc(icn) + '" width="' + sz + '" height="' + sz + '" alt="' + esc(name) + '" style="display:block;width:' + sz + 'px;height:' + sz + 'px;border:0;outline:none;">' : '<span style="font-size:11px;line-height:' + sz + 'px;color:' + col + ';text-decoration:underline;">' + esc(name) + '</span>';
      h += '<td style="padding:0 6px;"><a href="' + href + '" target="_blank" style="text-decoration:none;color:' + col + ';">' + inner + '</a></td>\n';
    });
    h += '</tr></table>\n';
  }
  if (so.title) h += '<p style="margin:' + (items.length ? '12px' : '0') + ' 0 0 0;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:.03em;color:' + col + ';">' + esc(so.title) + '</p>\n';
  const lines = String(so.contato || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length) h += '<p style="margin:10px 0 0 0;font-size:10px;line-height:16px;letter-spacing:.03em;color:' + col + ';">' + lines.map(l => fmtInline(l, col, S)).join('<br>') + '</p>\n';
  if (so.unsub && so.unsubText) h += '<p style="margin:12px 0 0 0;font-size:8px;line-height:12px;letter-spacing:.03em;color:' + col + ';opacity:.7;">' + fmtInline(so.unsubText, col, S) + '</p>\n';
  h += '</td></tr></table>\n</td>\n</tr>\n';
  return h;
}

function fmtText(raw: string, linkColor: string, S: S) {
  const paras = String(raw || '').replace(/\r/g, '').split(/\n\s*\n/).map(p => p.replace(/^\n+|\n+$/g, '')).filter(p => p.trim());
  return paras.map((p, i) => {
    let h = esc(p);
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => { const lu = linkMapOf(S)[u.toLowerCase()]; return '<a href="' + (lu ? esc(lu) : u) + '" target="_blank" style="color:' + linkColor + ';text-decoration:underline;">' + t + '</a>'; });
    h = h.replace(/\n/g, '<br>\n');
    return '<p style="margin:0 0 ' + (i < paras.length - 1 ? 20 : 0) + 'px 0;">' + h + '</p>';
  }).join('\n');
}

export function upperKeepVars(t: string) { return String(t).split(/(\{\w+\})/).map(p => /^\{\w+\}$/.test(p) ? p : p.toLocaleUpperCase('pt-BR')).join(''); }

function imgRow(img: EmailImage, preview: boolean, w: number, h: number, label: string) {
  let src = img.src;
  if (!src) { if (!preview) return ''; src = placeholder(w, h, label); }
  const tag = '<img src="' + esc(src) + '" width="600" alt="' + esc(img.alt) + '" class="fluid" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;">';
  const inner = img.link ? '<a href="' + esc(img.link) + '" target="_blank" style="display:block;">' + tag + '</a>' : tag;
  return '<tr>\n<td style="padding:0;font-size:0;line-height:0;">' + inner + '</td>\n</tr>\n';
}

const C = '<' + '!--';

/**
 * HTML final do e-mail. `preview = true` mostra espaços reservados para imagens que
 * faltam; `highlight` (só na prévia) destaca as variáveis em amarelo.
 */
export function generateEmailHtml(S: S, opts: { preview?: boolean, highlight?: boolean } = {}) {
  const preview = !!opts.preview;
  const font = S.font === 'arial' ? "Arial,Helvetica,sans-serif" : "Poppins,Roboto,'Helvetica Neue',Arial,sans-serif";
  const fontLink = S.font === 'arial' ? '' : '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap" rel="stylesheet">\n';
  const fs = parseInt(S.fontSize, 10) || 15;
  const label = S.btn.upper ? upperKeepVars(S.btn.text) : S.btn.text;
  const btnW = Math.max(220, Math.round(String(label).length * 9.2 + 64));
  const link = esc(S.btn.link || '#');
  let h = '';
  h += '<!DOCTYPE html>\n<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">\n<head>\n';
  h += '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<meta http-equiv="X-UA-Compatible" content="IE=edge">\n<meta name="x-apple-disable-message-reformatting">\n<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">\n';
  h += '<title>' + esc(S.assunto || S.nome) + '</title>\n' + fontLink;
  h += C + '[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->\n';
  h += '<style>\nbody{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}\ntable,td{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}\nimg{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}\n@media only screen and (max-width:620px){\n.container{width:100%!important;}\n.px{padding-left:16px!important;padding-right:16px!important;}\n.fluid{width:100%!important;height:auto!important;}\n}\n</style>\n</head>\n';
  h += '<body style="margin:0;padding:0;background-color:' + esc(S.bg) + ';-webkit-text-size-adjust:100%;">\n';
  h += C + '[if gte mso 9]><v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t"><v:fill type="tile" color="' + esc(S.bg) + '"/></v:background><![endif]-->\n';
  if (S.preheader) h += '<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">' + esc(S.preheader) + '&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>\n';
  h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="' + esc(S.bg) + '" style="background-color:' + esc(S.bg) + ';">\n<tr>\n<td align="center" style="padding:0;">\n';
  h += C + '[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->\n';
  h += '<table role="presentation" class="container" width="600" align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;margin:0 auto;background-color:#ffffff;">\n';
  if (S.webview.on) {
    const t = esc(S.webview.text || 'Visualizar como página web');
    const inner = S.webview.url ? '<a href="' + esc(S.webview.url) + '" target="_blank" style="color:#555555;text-decoration:underline;">' + t + '</a>' : t;
    h += '<tr>\n<td align="right" class="px" style="padding:12px 16px;background-color:' + esc(S.bg) + ';font-family:' + font + ';font-size:11px;line-height:16px;color:#555555;">' + inner + '</td>\n</tr>\n';
  }
  h += imgRow(S.banner, preview, 600, 214, 'Imagem do topo · 600 px de largura');
  const parts = String(S.texto || '').split(/^[ \t]*\[\s*bot[aã]o\s*\][ \t]*$/im);
  const before = parts[0], after = parts.slice(1).join('\n').trim();
  const al = ['left', 'justify', 'center'].includes(S.textAlign) ? S.textAlign : 'left';
  const tStyle = ';font-family:' + font + ';font-size:' + fs + 'px;line-height:' + Math.round(fs * 1.5625) + 'px;color:' + esc(S.textColor) + ';text-align:' + al + ';';
  if (before.trim()) h += '<tr>\n<td class="px" style="padding:40px 20px 0 20px' + tStyle + '">\n' + fmtText(before, esc(S.btn.bg), S) + '\n</td>\n</tr>\n';
  if (S.btn.text) {
    h += '<tr>\n<td align="center" class="px" style="padding:32px 20px ' + (after ? '32px' : '40px') + ' 20px;">\n';
    h += C + '[if mso]>\n<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="' + link + '" style="height:44px;v-text-anchor:middle;width:' + btnW + 'px;" arcsize="12%" stroke="f" fillcolor="' + esc(S.btn.bg) + '">\n<w:anchorlock/>\n<center style="color:' + esc(S.btn.color) + ';font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">' + esc(label) + '</center>\n</v:roundrect>\n<![endif]-->\n';
    h += C + '[if !mso]>' + C + '>\n<a href="' + link + '" target="_blank" style="display:inline-block;background-color:' + esc(S.btn.bg) + ';color:' + esc(S.btn.color) + ';font-family:' + font + ';font-size:14px;font-weight:bold;line-height:44px;text-align:center;text-decoration:none;padding:0 26px;border-radius:5px;-webkit-text-size-adjust:none;mso-hide:all;">' + esc(label) + '</a>\n' + C + '<![endif]-->\n';
    h += '</td>\n</tr>\n';
  } else if (!after) {
    h += '<tr><td style="padding:0 0 40px 0;font-size:0;line-height:0;">&nbsp;</td></tr>\n';
  }
  if (after) h += '<tr>\n<td class="px" style="padding:' + (S.btn.text ? '0' : '24px') + ' 20px 40px 20px' + tStyle + '">\n' + fmtText(after, esc(S.btn.bg), S) + '\n</td>\n</tr>\n';
  const footRow = imgRow(S.footer, preview, 600, 160, 'Imagem do rodapé · 600 px de largura');
  h += (S.social && S.social.pos === 'above') ? socialRow(font, S) + footRow : footRow + socialRow(font, S);
  h += '</table>\n' + C + '[if mso]></td></tr></table><![endif]-->\n</td>\n</tr>\n</table>\n</body>\n</html>\n';
  return applyVars(applyLinks(h, esc(S.btn.bg), S), preview && !!opts.highlight, S);
}
