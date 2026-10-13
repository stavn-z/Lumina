// Tipos do módulo Comunicação. O formato de `data` é o mesmo do protótipo
// (docs/gerador-email.html), para o backup dele importar sem conversão.

export type TemplateType = 'email' | 'sms' | 'whatsapp';

export interface EmailImage {
  src: string;
  upload: string;
  alt: string;
  link: string;
  orig?: { src: string, upload: string };
}

export interface SocialItem { rede: string, link: string, icon: string }

export interface KeyValue { k: string, v: string }

export interface EmailData {
  nome: string;
  assunto: string;
  preheader: string;
  webview: { on: boolean, text: string, url: string };
  banner: EmailImage;
  texto: string;
  textColor: string;
  fontSize: string;
  font: string;
  btn: { text: string, link: string, bg: string, color: string, upper: boolean };
  footer: EmailImage;
  bg: string;
  textAlign: string;
  social: {
    on: boolean, bg: string, accent: string, color: string, size: string, title: string,
    contato: string, unsub: boolean, unsubText: string, iconStyle: string, pos: string,
    items: SocialItem[],
  };
  vars: KeyValue[];
  links: KeyValue[];
}

export interface WppButton { type: 'url' | 'phone' | 'reply', text: string, value: string }

export interface TextData {
  header: { type: 'none' | 'media' | 'text', text: string, mtype: 'image' | 'video' | 'document', src: string, upload: string };
  footer: { type: 'none' | 'text', text: string };
  btnMode: 'none' | 'cta' | 'reply';
  buttons: WppButton[];
  nome: string;
  assunto: string;
  texto: string;
  vars: KeyValue[];
  links: KeyValue[];
}

export type TemplateData = EmailData | TextData;

export type HistoryKind = 'created' | 'dup' | 'edit' | 'rubeus_on' | 'rubeus_off' | 'rubeus_upd' | 'start';

export interface HistoryEntry {
  t: number;
  kind: HistoryKind;
  fields?: string[];
  from?: string;
  by?: string; // responsibles.id (extra do Lumina; o protótipo ignora)
}

export interface TemplateRow {
  id: string;
  type: TemplateType;
  data: any;
  nome: string;
  history: HistoryEntry[];
  rubeus_done: boolean;
  rubeus_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  legacy_key: string | null;
  rev: number;
}

export type TaxListKey = 'centro' | 'canal' | 'processo' | 'unidade' | 'modalidade' | 'tipo';

export interface TaxOption { l: string, c: string }

export type TaxLists = Record<TaxListKey, TaxOption[]>;

export interface TaxClientRow {
  id: string;
  name: string;
  lists: TaxLists;
  created_at: string;
  updated_at: string;
  rev: number;
}
