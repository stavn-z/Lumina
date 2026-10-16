import { useEffect, useRef, useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import { Crop, Loader2 } from "lucide-react";
import { inputCls } from "./parts.tsx";
import { ScreenOverlay } from "../ui/ScreenOverlay.tsx";

// Recorte de imagem — port do recorte do protótipo (caixa arrastável, cantos para
// redimensionar, proporções Livre/Original/3:1/2:1/16:9/1:1 e largura final).
// O resultado sai como Blob; quem chama envia ao storage.

const RATIOS: [string, string][] = [['free', 'Livre'], ['orig', 'Original'], ['3', '3:1'], ['2', '2:1'], ['1.7778', '16:9'], ['1', '1:1']];
type Box = { x: number, y: number, w: number, h: number };
type Drag = { mode: 'move', dx: number, dy: number } | { mode: 'resize', fx: number, fy: number } | null;

export const extOf = (src: string) => (/^data:image\/png|\.png(\?|$)/i.test(src) ? 'png' : 'jpg');

export function CropDialog({ src, onCancel, onApply, onLoadError }: {
  src: string, onCancel: () => void, onApply: (blob: Blob, ext: string) => Promise<void>, onLoadError: () => void,
}) {
  const img = useRef<HTMLImageElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [ratioKey, setRatioKey] = useState('free');
  const [ratio, setRatio] = useState<number | null>(null);
  const [width, setWidth] = useState('1200');
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const drag = useRef<Drag>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!busy) onCancel(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel, busy]);

  const dims = () => ({ W: img.current?.clientWidth || 0, H: img.current?.clientHeight || 0 });
  const fit = (r: number | null) => {
    const { W, H } = dims(); let w = W, h = H;
    if (r) { if (W / H > r) w = H * r; else h = W / r; }
    setBox({ x: (W - w) / 2, y: (H - h) / 2, w, h });
  };

  const scale = () => (img.current ? img.current.naturalWidth / (img.current.clientWidth || 1) : 1);
  const sw = Math.round(box.w * scale()), sh = Math.round(box.h * scale());
  const tw = +width || sw;
  const sizeLabel = loaded ? `${tw} × ${Math.round(tw * sh / Math.max(sw, 1))} px` : '';

  const point = (e: RPointerEvent) => {
    const r = stage.current!.getBoundingClientRect(); const { W, H } = dims();
    return { x: Math.min(W, Math.max(0, e.clientX - r.left)), y: Math.min(H, Math.max(0, e.clientY - r.top)) };
  };
  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    const h = (e.target as HTMLElement).dataset.h; const b = box;
    if (h) drag.current = { mode: 'resize', fx: h.includes('w') ? b.x + b.w : b.x, fy: h.includes('n') ? b.y + b.h : b.y };
    else { const p = point(e); drag.current = { mode: 'move', dx: p.x - b.x, dy: p.y - b.y }; }
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d) return;
    const p = point(e); const { W, H } = dims(); const b = box;
    if (d.mode === 'move') {
      setBox({ ...b, x: Math.min(W - b.w, Math.max(0, p.x - d.dx)), y: Math.min(H - b.h, Math.max(0, p.y - d.dy)) });
      return;
    }
    const { fx, fy } = d; let w = Math.max(16, Math.abs(p.x - fx)), h = Math.max(16, Math.abs(p.y - fy));
    if (ratio) { if (w / h > ratio) w = h * ratio; else h = w / ratio; }
    let x = p.x < fx ? fx - w : fx, y = p.y < fy ? fy - h : fy;
    if (x < 0) { x = 0; w = fx; if (ratio) h = w / ratio; y = p.y < fy ? fy - h : fy; }
    if (y < 0) { y = 0; h = fy; if (ratio) w = h * ratio; x = p.x < fx ? fx - w : fx; }
    if (x + w > W) { w = W - x; if (ratio) h = w / ratio; y = p.y < fy ? fy - h : fy; }
    if (y + h > H) { h = H - y; if (ratio) w = h * ratio; x = p.x < fx ? fx - w : fx; }
    setBox({ x, y, w, h });
  };
  const onUp = () => { drag.current = null; };

  const pickRatio = (k: string) => {
    const el = img.current!;
    const r = k === 'free' ? null : k === 'orig' ? el.naturalWidth / el.naturalHeight : parseFloat(k);
    setRatioKey(k); setRatio(r); fit(r);
  };

  async function apply() {
    const el = img.current!; const sc = scale();
    // Área de origem sempre dentro da imagem: o tamanho exibido é arredondado e uma sobra de
    // fração de pixel ficaria sem pintar (preta no JPEG) na borda do recorte.
    const nW = el.naturalWidth, nH = el.naturalHeight;
    const sx = Math.min(Math.max(0, box.x * sc), nW - 1), sy = Math.min(Math.max(0, box.y * sc), nH - 1);
    const sW = Math.min(box.w * sc, nW - sx), sH = Math.min(box.h * sc, nH - sy);
    const w = Math.round(+width || sW), h = Math.round(w * sH / sW);
    const ext = extOf(src);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d')!; ctx.imageSmoothingQuality = 'high';
    // JPEG não tem transparência: fundo branco em vez de preto para pixels transparentes.
    if (ext !== 'png') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(el, sx, sy, sW, sH, 0, 0, w, h);
    let blob: Blob | null = null;
    try { blob = await new Promise<Blob | null>(res => cv.toBlob(res, ext === 'png' ? 'image/png' : 'image/jpeg', 0.9)); } catch { blob = null; }
    if (!blob) { onLoadError(); return; }
    setBusy(true);
    try { await onApply(blob, ext); } finally { setBusy(false); }
  }

  const handle = 'absolute w-4 h-4 bg-white rounded shadow-[0_1px_3px_rgba(0,0,0,.4)] touch-none';
  return (
    <ScreenOverlay className="px-3 pt-3 pb-24 sm:p-4 z-[115]" onClick={() => !busy && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby="com-crop-title" className="w-full max-w-3xl max-h-[90dvh] overflow-y-auto kp-scroll rounded-[32px] bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-5 sm:p-7 shadow-2xl animate-modal-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-2 text-indigo-400">
          <div className="p-3 bg-indigo-500/10 rounded-2xl"><Crop size={22} /></div>
          <h3 id="com-crop-title" className="font-bold text-xl tracking-tight text-[var(--text-primary)]">Recortar imagem</h3>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">Arraste a área para mover e use os cantos para redimensionar.</p>
        {!loaded && <p className="flex items-center justify-center gap-2 py-10 text-xs font-bold uppercase tracking-widest text-indigo-400"><Loader2 size={14} className="animate-spin" />Carregando imagem…</p>}
        <div className={`${loaded ? 'flex' : 'hidden'} justify-center rounded-2xl p-3 mb-4`} style={{ background: 'repeating-conic-gradient(var(--bg-tertiary) 0 25%, var(--bg-primary) 0 50%) 0 0/16px 16px' }}>
          <div ref={stage} className="relative inline-block select-none">
            <img
              ref={img} src={src} alt="" crossOrigin={src.startsWith('data:') ? undefined : 'anonymous'} draggable={false}
              className="block max-w-full max-h-[50dvh]"
              onLoad={() => { setLoaded(true); requestAnimationFrame(() => requestAnimationFrame(() => fit(null))); }}
              onError={onLoadError}
            />
            {/* A sombra que escurece o que fica fora do recorte vive numa camada cortada no
                tamanho da imagem; solta, ela escurecia o popup inteiro (controles e botões). */}
            {loaded && (
              <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute" style={{ left: box.x, top: box.y, width: box.w, height: box.h, boxShadow: '0 0 0 9999px rgba(0,0,0,.55)' }} />
              </div>
            )}
            {loaded && (
              <div
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                className="absolute border-2 border-white cursor-move touch-none"
                style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
              >
                <span data-h="nw" className={handle + ' -left-2 -top-2 cursor-nwse-resize'} />
                <span data-h="ne" className={handle + ' -right-2 -top-2 cursor-nesw-resize'} />
                <span data-h="sw" className={handle + ' -left-2 -bottom-2 cursor-nesw-resize'} />
                <span data-h="se" className={handle + ' -right-2 -bottom-2 cursor-nwse-resize'} />
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Proporção</span>
            <div role="group" aria-label="Proporção" className="flex flex-wrap gap-0.5 p-1 rounded-xl border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
              {RATIOS.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={ratioKey === k} onClick={() => pickRatio(k)} className={`h-8 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${ratioKey === k ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{l}</button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Largura final</span>
            <select value={width} onChange={e => setWidth(e.target.value)} className={inputCls + ' cursor-pointer'}>
              <option value="1200">1200 px (recomendado)</option><option value="600">600 px</option><option value="0">Tamanho original</option>
            </select>
          </label>
          <span className="text-xs font-mono text-[var(--text-muted)] pb-3">{sizeLabel}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="w-full sm:flex-1 py-3 rounded-2xl border border-[var(--border-primary)] hover:bg-[var(--bg-overlay)] text-[var(--text-primary)] font-bold text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40">Cancelar</button>
          <button type="button" disabled={busy || !loaded} onClick={apply} className="w-full sm:flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/10 inline-flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />}{busy ? 'Enviando…' : 'Aplicar recorte'}
          </button>
        </div>
      </div>
    </ScreenOverlay>
  );
}
