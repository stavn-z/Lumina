#!/usr/bin/env node
// Verifica que o HTML de e-mail gerado pelo Lumina (src/comunicacao/lib/emailHtml.ts) é
// IDÊNTICO ao do protótipo (docs/gerador-email.html) para os mesmos dados.
//
// Como funciona: extrai do protótipo o trecho original de DEFAULT até generate() e o
// executa no Node (vm) com um DOM "neutro" que ignora a interface. Depois gera o HTML dos
// dois lados — e-mail final, prévia e prévia com "Destacar variáveis" — e compara byte a byte.
// Também confere que o ajuste de dados ao carregar (merge com DEFAULT) é igual.
//
// Uso: node scripts/verificar-email-html.mjs   (Node 22.18+; sem dependências)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'docs/gerador-email.html'), 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const start = js.indexOf("const KEY='gerador-email:v1';");
const end = js.indexOf('/* campos */');
if (start < 0 || end < 0) throw new Error('Trecho do gerador não encontrado no protótipo.');

// DOM neutro: qualquer acesso devolve ele mesmo; `$('#hl').checked` lê HL.v.
const HL = { v: false };
const hole = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'checked' ? HL.v : hole),
  apply: () => hole,
  construct: () => hole,
});
const ctx = { document: hole, localStorage: { getItem: () => null, setItem() {} }, getComputedStyle: () => hole, Blob, encodeURIComponent, HL };
vm.createContext(ctx);
vm.runInContext('(function(){' + js.slice(start, end) +
  ';globalThis.__gen=(st,p,h)=>{S=st;HL.v=h;return generate(p)};globalThis.__DEF=DEFAULT;globalThis.__load=d=>merge(clone(DEFAULT),d)})()', ctx);

const { generateEmailHtml } = await import(pathToFileURL(path.join(ROOT, 'src/comunicacao/lib/emailHtml.ts')).href);
const { normalizeData } = await import(pathToFileURL(path.join(ROOT, 'src/comunicacao/defaults.ts')).href);

const copy = o => JSON.parse(JSON.stringify(o));
const cases = [['padrão (DEFAULT do protótipo)', copy(ctx.__DEF)]];
const fxDir = path.join(ROOT, 'scripts/fixtures');
for (const f of fs.readdirSync(fxDir).filter(f => f.startsWith('email-') && f.endsWith('.json')).sort()) {
  cases.push([f, JSON.parse(fs.readFileSync(path.join(fxDir, f), 'utf8'))]);
}

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `posição ${i}\n  protótipo: ${JSON.stringify(a.slice(Math.max(0, i - 60), i + 60))}\n  lumina:    ${JSON.stringify(b.slice(Math.max(0, i - 60), i + 60))}`;
}

let fails = 0;
for (const [name, raw] of cases) {
  const proto = JSON.parse(JSON.stringify(ctx.__load(copy(raw))));
  const lumina = normalizeData('email', copy(raw));
  const sameLoad = JSON.stringify(proto) === JSON.stringify(lumina);
  console.log(`\n▸ ${name}`);
  console.log(`  ${sameLoad ? '✓' : '✗'} dados carregados iguais`);
  if (!sameLoad) fails++;
  for (const [label, preview, hl] of [['e-mail final (Copiar HTML)', false, false], ['prévia', true, false], ['prévia com destaque', true, true]]) {
    const a = ctx.__gen(copy(proto), preview, hl);
    const b = generateEmailHtml(copy(proto), { preview, highlight: hl });
    if (a === b) console.log(`  ✓ ${label}: idêntico (${a.length} caracteres)`);
    else { fails++; console.log(`  ✗ ${label}: DIFERENTE — ${firstDiff(a, b)}`); }
  }
}
console.log(fails ? `\n✗ ${fails} diferença(s) encontrada(s).` : `\n✓ Todos os ${cases.length} templates geram HTML idêntico ao do protótipo.`);
process.exit(fails ? 1 : 0);
