import { useRef, useState } from "react";
import { Crop, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { ImageUploadError, uploadImage } from "../data/imageUpload.ts";
import { errorText } from "../data/supa.ts";
import { useAsk } from "../ui/Dialogs.tsx";
import { useToast } from "../ui/Toast.tsx";
import type { EmailImage } from "../types.ts";
import { CropDialog } from "./CropDialog.tsx";
import { inputCls, miniBtn, xBtn } from "./parts.tsx";

// Imagem do topo/rodapé: link direto OU envio do arquivo para o storage (URL pública
// permanente). Depois de enviar, abre o recorte. "Original" volta para a imagem sem recorte.

const baseName = (n: string) => String(n || 'imagem').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w-]+/g, '-').slice(0, 60) || 'imagem';

// `edit` aplica a mudança sobre a versão MAIS RECENTE do rascunho (o envio é assíncrono e
// o texto alternativo pode ter sido editado nesse meio-tempo).
export function ImageField({ img, which, edit }: { img: EmailImage, which: 'banner' | 'footer', edit: (fn: (i: EmailImage) => void) => void }) {
  const ask = useAsk();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const cropFrom = (i: EmailImage) => (i.orig ? i.orig.src : i.src);
  const cropError = () => { setCropSrc(null); toast('Essa imagem não permite recorte pelo link. Envie o arquivo para recortar.'); };

  async function onFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImage(f);
      edit(i => { i.src = url; i.upload = f.name; delete i.orig; });
      setCropSrc(url);
    } catch (e) {
      toast(e instanceof ImageUploadError ? e.message : 'Não foi possível enviar a imagem: ' + errorText(e));
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  }

  async function applyCrop(blob: Blob, ext: string) {
    try {
      const url = await uploadImage(blob);
      edit(i => {
        if (!i.orig) i.orig = { src: i.src, upload: i.upload || '' };
        i.upload = baseName(i.upload || (which === 'banner' ? 'topo' : 'rodape')) + '-recortada.' + ext;
        i.src = url;
      });
      setCropSrc(null);
      toast('Recorte aplicado');
    } catch (e) {
      toast(e instanceof ImageUploadError ? e.message : 'Não foi possível enviar o recorte: ' + errorText(e));
    }
  }

  async function restoreOriginal() {
    if (!img.orig) return;
    if (!await ask({ title: 'Voltar para a imagem original?', message: 'O recorte atual será descartado.', ok: 'Voltar ao original' })) return;
    edit(i => { if (!i.orig) return; i.src = i.orig.src; i.upload = i.orig.upload || ''; delete i.orig; });
    toast('Imagem original restaurada');
  }

  async function remove() {
    if (!await ask({ title: 'Remover imagem?', message: 'A imagem será retirada deste template.', ok: 'Remover', tone: 'danger' })) return;
    edit(i => { i.src = ''; i.upload = ''; delete i.orig; });
  }

  return (
    <div className="flex flex-col gap-2">
      {img.upload && img.src ? (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}>
          <img src={img.src} alt="" className="w-14 h-10 object-cover rounded-md bg-[var(--bg-tertiary)] shrink-0" />
          <span className="text-xs font-mono text-[var(--text-secondary)] truncate flex-1 min-w-[100px]" title={img.upload}>{img.upload}</span>
          <button type="button" onClick={() => setCropSrc(cropFrom(img))} className={miniBtn}><Crop size={12} />Recortar</button>
          {img.orig && <button type="button" onClick={restoreOriginal} title="Voltar para a imagem original, sem recorte" className={miniBtn}><RotateCcw size={12} />Original</button>}
          <button type="button" aria-label="Remover imagem" onClick={remove} className={xBtn}><X size={14} /></button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input type="url" aria-label="URL da imagem" placeholder="https://… link direto da imagem (.png ou .jpg)" value={img.src || ''} onChange={e => { const v = e.target.value.trim(); edit(i => { i.src = v; i.upload = ''; delete i.orig; }); }} className={inputCls + ' flex-1 min-w-[180px]'} />
          {img.src && <button type="button" onClick={() => setCropSrc(cropFrom(img))} className={miniBtn}><Crop size={12} />Recortar</button>}
          <button type="button" disabled={uploading} onClick={() => file.current?.click()} className={miniBtn}>
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}{uploading ? 'Enviando…' : 'Enviar arquivo'}
          </button>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={e => onFile(e.target.files?.[0])} />
        </div>
      )}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">Envie o arquivo (ele vai para o armazenamento do Lumina, com link permanente que funciona no Gmail e no Outlook) ou cole o link direto de uma imagem já hospedada. Exporte do Figma em 2x (1200 px).</p>
      {cropSrc && <CropDialog src={cropSrc} onCancel={() => setCropSrc(null)} onApply={applyCrop} onLoadError={cropError} />}
    </div>
  );
}
