import type { EmailData } from "../types.ts";
import { linkMapOf, usedLinks, usedVars, varMap } from "./emailHtml.ts";

// Avisos do editor de e-mail (port de warnings do protótipo). Sem os avisos de imagem
// embutida em base64 e de falta de espaço no navegador: no Lumina toda imagem enviada vai
// para o storage e o conteúdo fica no banco.
export const GMAIL_CLIP_BYTES = 102000;

export function emailWarnings(S: EmailData, code: string): string[] {
  const w: string[] = [];
  const map = varMap(S);
  const miss = [...usedVars(S)].filter(k => !(k in map));
  if (miss.length) w.push('Variável usada mas não declarada: ' + miss.map(k => '{' + k + '}').join(', ') + '. Declare em Variáveis ou ela vai sair como texto.');
  const lm = linkMapOf(S);
  const used = usedLinks([S.texto, S.btn.link, S.banner.link, S.footer.link, S.social && S.social.on ? S.social.contato : ''].join(' '));
  const missL = [...used].filter(k => !lm[k]);
  if (missL.length) w.push('Link sem endereço: ' + missL.map(k => '[' + k + ']').join(', ') + '. Defina em Links ou ele vai sair como texto.');
  if (!S.banner.src) w.push('Falta a imagem do topo. A prévia mostra um espaço reservado, mas ele não entra no HTML.');
  if (!S.footer.src) w.push('Falta a imagem do rodapé.');
  if (S.banner.src.startsWith('data:') || S.footer.src.startsWith('data:')) w.push('Há imagem embutida no HTML (base64). Envie o arquivo de novo para ele ir ao armazenamento com link permanente.');
  if (code.length > GMAIL_CLIP_BYTES) w.push('O HTML passou de 102 KB, e o Gmail corta e-mails maiores que isso.');
  return w;
}

/** Tamanho do HTML como o protótipo mostra (ex.: "4,5 KB"). */
export const sizeLabel = (code: string) => (new Blob([code]).size / 1024).toFixed(1).replace('.', ',') + ' KB';
