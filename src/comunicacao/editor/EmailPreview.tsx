import { useEffect, useRef, useState } from "react";
import { placeholder } from "../lib/emailHtml.ts";

// Prévia do e-mail num iframe isolado (o HTML do e-mail não herda o tema do Lumina).
// A altura acompanha o conteúdo (fitFrame) e, quando falta espaço (celular), a prévia é
// reduzida em escala em vez de criar rolagem lateral. Imagens externas que não carregam
// viram um espaço reservado, como no protótipo (extPh).

function extPh(im: HTMLImageElement) {
  const w = parseInt(im.getAttribute('width') || '', 10) || 600; const small = w < 80;
  const h = small ? w : Math.round(w * 0.3);
  im.removeAttribute('srcset');
  im.src = small
    ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + w + '"><circle cx="' + w / 2 + '" cy="' + w / 2 + '" r="' + (w / 2 - 1) + '" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-dasharray="3 3"/></svg>')
    : placeholder(w, h, 'Imagem externa: aparece no e-mail enviado');
}

export function EmailPreview({ html, width }: { html: string, width: number }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(600);
  const [avail, setAvail] = useState(width);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = () => {
    try {
      const d = frame.current?.contentDocument;
      if (d && d.body) { const t = d.querySelector('body>table'); setHeight(Math.ceil(t ? t.getBoundingClientRect().height : d.body.scrollHeight)); }
    } catch {}
  };

  const onLoad = () => {
    fit();
    try {
      frame.current?.contentDocument?.querySelectorAll('img').forEach(i => {
        if (i.complete && i.naturalWidth === 0 && !i.src.startsWith('data:')) extPh(i);
        i.addEventListener('load', fit);
        i.addEventListener('error', () => { if (!i.src.startsWith('data:')) extPh(i); setTimeout(fit, 0); });
      });
    } catch {}
  };

  useEffect(() => { const t = setTimeout(fit, 260); return () => clearTimeout(t); }, [width]);

  const scale = Math.min(1, avail / width);
  return (
    <div ref={wrap} className="w-full flex justify-center">
      <div style={{ width: width * scale, height: height * scale }} className="relative">
        <iframe
          ref={frame}
          title="Prévia do e-mail"
          srcDoc={html}
          onLoad={onLoad}
          className="absolute top-0 left-0 border-0 bg-white rounded-lg shadow-lg"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
      </div>
    </div>
  );
}
