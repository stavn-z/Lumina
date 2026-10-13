import { useEffect, useMemo, useRef, useState } from "react";
import { generateEmailHtml } from "../lib/emailHtml.ts";
import { MessageBubble } from "../ui/MessageBubble.tsx";
import type { TemplateRow } from "../types.ts";

// Miniatura do cartão. E-mail: o HTML real reduzido num iframe, montado só quando o
// cartão chega perto da área visível (muitos iframes pesam). SMS/WhatsApp: o balão.
export function Thumb({ row }: { row: TemplateRow }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (row.type !== 'email' || visible || !ref.current) return;
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [row.type, visible]);

  const html = useMemo(
    () => (row.type === 'email' && visible ? generateEmailHtml(row.data).replace(/<a /g, '<a tabindex="-1" ') : ''),
    [row.type, row.data, visible],
  );

  if (row.type !== 'email') {
    return (
      <div className="com-thumb h-[230px] overflow-hidden flex flex-col justify-start text-left" style={{ background: row.type === 'sms' ? '#f2f2f7' : '#efeae2', padding: '18px 16px' }}>
        <MessageBubble data={row.data} type={row.type} />
      </div>
    );
  }
  return (
    <div ref={ref} className="h-[230px] overflow-hidden relative" style={{ background: 'var(--bg-tertiary)' }}>
      {html && (
        <iframe
          title=""
          aria-hidden="true"
          tabIndex={-1}
          loading="lazy"
          srcDoc={html}
          className="absolute top-[14px] left-1/2 w-[600px] h-[1200px] border-0 pointer-events-none bg-white"
          style={{ transform: 'translateX(-50%) scale(.4)', transformOrigin: '50% 0' }}
        />
      )}
    </div>
  );
}
