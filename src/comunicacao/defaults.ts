import type { EmailData, TaxLists, TemplateType, TextData } from "./types.ts";

// Valores padrão copiados literalmente do protótipo (DEFAULT, txDefault e DEF.lists).

export const DEFAULT: EmailData = {
  nome: 'CAP_EML_GRD_EN_EAD_REP_C2',
  assunto: 'No EAD da Celso Lisboa, você tem acompanhamento próximo',
  preheader: 'Encontro com mentor, projetos práticos e nota máxima no MEC.',
  webview: { on: true, text: 'Visualizar como página web', url: '{view}' },
  banner: { src: '', upload: '', alt: 'Celso Lisboa – No ritmo do seu futuro', link: '' },
  texto: 'Oi, {1}!\n\nFicou alguma dúvida antes de dar o próximo passo: rotina de estudos, o nosso EAD Mentoria ou outro ponto?\n\nEstamos aqui para ajudar você na sua melhor decisão.\nVale lembrar o que você encontra na nossa Graduação EAD:\n\n✅ Encontro individual com mentor agendado por você para não travar em nenhum momento\n✅ Metodologia LIGA: projetos práticos desde o início do curso\n✅ Professores renomados e com experiência relevante na sua área de atuação\n\nTudo isso com ensino nota máxima no MEC.\nSua condição segue reservada enquanto sua inscrição está ativa. Vem pra Celso 💛',
  textColor: '#625f5f',
  fontSize: '16',
  font: 'poppins',
  btn: { text: 'Concluir minha inscrição', link: 'https://celsolisboa.edu.br/', bg: '#0095d9', color: '#ffffff', upper: true },
  footer: { src: '', upload: '', alt: 'Celso Lisboa – Centro Universitário', link: '' },
  bg: '#e5e5e5',
  textAlign: 'left',
  social: {
    on: false, bg: '#01348d', accent: '#0187ce', color: '#ffffff', size: '30', title: 'Entre em contato conosco', contato: '', unsub: false,
    unsubText: 'Se deseja não receber mais mensagens como esta, [descadastre-se]({unsubscribe}).', iconStyle: 'light', pos: 'below',
    items: [
      { rede: 'instagram', link: '', icon: '' },
      { rede: 'facebook', link: '', icon: '' },
      { rede: 'youtube', link: '', icon: '' },
      { rede: 'linkedin', link: '', icon: '' },
    ],
  },
  vars: [{ k: '1', v: '@@nome_da_pessoa@@' }],
  links: [{ k: 'link', v: '' }],
};

export function txDefault(type: TemplateType): TextData {
  return {
    header: { type: 'none', text: '', mtype: 'image', src: '', upload: '' },
    footer: { type: 'none', text: '' },
    btnMode: type === 'whatsapp' ? 'cta' : 'none',
    buttons: type === 'whatsapp' ? [{ type: 'url', text: 'Concluir inscrição', value: '[link]' }] : [],
    nome: '',
    assunto: '',
    texto: type === 'sms'
      ? 'Celso Lisboa: {1}, sua vaga ainda esta reservada. Conclua sua inscricao em celsolisboa.edu.br'
      : 'Oi, {1}! 👋\n\nSua vaga na *Celso Lisboa* continua reservada.\nQuer ajuda para concluir sua inscrição?',
    vars: [{ k: '1', v: '@@nome_da_pessoa@@' }],
    links: [{ k: 'link', v: '' }],
  };
}

export const DEF_LISTS: TaxLists = {
  centro: [{ l: 'Captação', c: 'CAP' }, { l: 'Financeiro', c: 'FIN' }, { l: 'Apoio', c: 'APO' }, { l: 'Outros', c: 'OUT' }],
  canal: [{ l: 'WhatsApp', c: 'WPP' }, { l: 'E-mail', c: 'EML' }, { l: 'SMS', c: 'SMS' }, { l: 'RCS', c: 'RCS' }],
  processo: [{ l: 'Graduação', c: 'GRD' }, { l: 'Pós', c: 'POS' }, { l: 'Ambos', c: 'AMB' }],
  unidade: [{ l: 'Engenho Novo', c: 'EN' }, { l: 'Bangu', c: 'BG' }, { l: 'Campo Grande', c: 'CG' }, { l: 'Tijuca', c: 'TJ' }, { l: 'Zona Oeste', c: 'ZO' }],
  modalidade: [{ l: 'EAD', c: 'EAD' }, { l: 'Presencial', c: 'PRE' }, { l: 'Semipresencial', c: 'SEM' }, { l: 'Inscrito', c: 'INS' }, { l: 'Inscrito parcial', c: 'INSP' }],
  tipo: [{ l: 'Primeiro contato', c: 'PRM' }, { l: 'Repique', c: 'REP' }],
};

export const TAX_KEYS = Object.keys(DEF_LISTS) as (keyof TaxLists)[];

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

// merge do protótipo: objetos se fundem recursivamente; arrays e valores substituem.
export function merge(a: any, b: any) {
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}

// Mesmo ajuste que o protótipo faz ao carregar a biblioteca (LIB.items.forEach…).
export function normalizeData(type: TemplateType, raw: any): EmailData | TextData {
  if (type === 'email') {
    const d: EmailData = merge(clone(DEFAULT), raw || {});
    (d.social.items || []).forEach(i => { if (/markaimg\.com/.test(i.icon || '')) i.icon = ''; });
    return d;
  }
  const had = raw || {};
  const d: TextData = Object.assign(txDefault(type), { buttons: [] }, had);
  if (type === 'whatsapp' && d.nome) d.nome = String(d.nome).toLowerCase();
  if (!had.btnMode) {
    const bs = d.buttons || [];
    d.btnMode = !bs.length ? 'none' : bs.every(b => b.type === 'reply') ? 'reply' : 'cta';
    if (d.btnMode === 'cta') d.buttons = bs.filter(b => b.type !== 'reply');
  }
  if (!d.header) d.header = { type: 'none', text: '', mtype: 'image', src: '', upload: '' };
  if (!d.footer) d.footer = { type: 'none', text: '' };
  return d;
}

export function normalizeLists(raw: any): TaxLists {
  const out = {} as TaxLists;
  for (const k of TAX_KEYS) out[k] = Array.isArray(raw?.[k]) ? raw[k] : [];
  return out;
}
