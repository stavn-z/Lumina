import type { TaxLists } from "../types.ts";

// Taxonomia: regra do nome padronizado (port de sig, dmy e build do protótipo).

export const LABELS: Record<keyof TaxLists, string> = {
  centro: 'Centro de custo', canal: 'Canal', processo: 'Processo', unidade: 'Unidade', modalidade: 'Modalidade', tipo: 'Tipo de contato',
};
export const SINGLE = ['centro', 'canal', 'processo', 'unidade'] as const;

export interface TaxSel {
  mode: 'campanha' | 'template';
  centro: string; outro: string; canal: string; processo: string; unidade: string;
  modalidade: string[]; tipo: string; num: string;
  ini: string; fim: string; disp: string; oferta: string;
}

export const DEF_SEL: TaxSel = { mode: 'campanha', centro: 'CAP', outro: '', canal: 'EML', processo: 'GRD', unidade: 'EN', modalidade: ['EAD'], tipo: 'REP', num: '2', ini: '', fim: '', disp: '', oferta: '' };

/** Sigla: sem acento, maiúscula, só letras e números. */
export const sig = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** AAAA-MM-DD → DDMMAA */
export const dmy = (v: string) => { if (!v) return ''; const [y, m, d] = v.split('-'); return d + m + y.slice(2); };

/** Seleção inicial de um cliente (como o protótipo: a Celso começa com o exemplo). */
export function initialSel(clientId: string): TaxSel {
  return clientId === 'celso' ? { ...DEF_SEL, modalidade: [...DEF_SEL.modalidade] } : { ...DEF_SEL, modalidade: [], tipo: '', num: '' };
}

/** Ajusta a seleção aos cadastros atuais (como renderSelects do protótipo). */
export function sanitizeSel(sel: TaxSel, lists: TaxLists): TaxSel {
  const s = { ...sel, modalidade: [...(sel.modalidade || [])] };
  for (const k of SINGLE) if (!lists[k].some(o => o.c === s[k])) s[k] = lists[k][0] ? lists[k][0].c : '';
  s.modalidade = s.modalidade.filter(c => lists.modalidade.some(o => o.c === c));
  if (s.tipo && !lists.tipo.some(o => o.c === s.tipo)) s.tipo = lists.tipo[0] ? lists.tipo[0].c : '';
  return s;
}

export interface NamePart { label: string, v: string }

/** Nome final: siglas unidas por _, modalidades por -, contato C1, período DDMMAA-DDMMAA,
 *  disparo DDMMAA, oferta sem espaços (até 8). Campanha em maiúsculas; Template em minúsculas e sem período. */
export function build(s: TaxSel): { name: string, parts: NamePart[] } {
  const camp = s.mode === 'campanha', parts: NamePart[] = [];
  const add = (label: string, v: string) => { if (v) parts.push({ label, v }); };
  let centro = s.centro;
  if (centro === 'OUT') { const sg = String(s.outro || '').replace(/\s+/g, '').slice(0, 4); centro = sg ? 'OUT-' + sg.toUpperCase() : 'OUT'; }
  add('Centro', centro); add('Canal', s.canal);
  add('Processo', s.processo); add('Unidade', s.unidade);
  add('Modalidade', s.modalidade.join('-'));
  add('Contato', s.tipo);
  const n = parseInt(s.num, 10); if (n > 0) add('Nº', 'C' + n);
  if (camp) { const per = [dmy(s.ini), dmy(s.fim)].filter(Boolean).join('-'); add('Período', per); }
  add('Disparo', dmy(s.disp));
  add('Oferta', String(s.oferta || '').replace(/\s+/g, '').slice(0, 8).toUpperCase());
  if (!camp) parts.forEach(p => { p.v = p.v.toLowerCase(); });
  return { name: parts.map(p => p.v).join('_'), parts };
}
