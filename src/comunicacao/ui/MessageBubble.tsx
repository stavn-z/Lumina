import { useEffect, useRef } from "react";
import { bubbleHtml, btnsHtml } from "../lib/textMsg.ts";
import type { TemplateType, TextData } from "../types.ts";

// Balão de SMS/WhatsApp (miniatura dos cartões e prévia do editor). O HTML vem de
// lib/textMsg.ts, que escapa todo texto digitado (esc) antes de montar as tags.
export function MessageBubble({ data, type, placeholder }: { data: TextData, type: TemplateType, placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const sms = type === 'sms';

  // Imagem do cabeçalho que não carrega (link externo bloqueado) vira texto, como no protótipo.
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLImageElement>('.wh-media img').forEach(i => {
      const f = () => { if (i.parentNode) i.parentNode.textContent = 'Imagem do cabeçalho (externa: aparece no envio)'; };
      if (i.complete && i.naturalWidth === 0 && !i.src.startsWith('data:')) f(); else i.addEventListener('error', f, { once: true });
    });
  });

  const html = data.texto ? bubbleHtml(data, type) : '';
  return (
    <div className={sms ? 'mr-auto' : 'ml-auto'} style={{ maxWidth: '88%', width: 'fit-content', minWidth: 200 }}>
      {html
        ? <div ref={ref} className={`com-bubble${sms ? ' sms' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />
        : <div className={`com-bubble${sms ? ' sms' : ''}`}><span style={{ opacity: .5 }}>{placeholder || 'Sua mensagem aparece aqui'}</span></div>}
      {type === 'whatsapp' && <div className="com-wbtns" dangerouslySetInnerHTML={{ __html: btnsHtml(data) }} />}
    </div>
  );
}
