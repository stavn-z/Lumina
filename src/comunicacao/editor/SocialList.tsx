import { useState } from "react";
import { X } from "lucide-react";
import { iconOf, MC, NETS } from "../lib/emailHtml.ts";
import { useAsk } from "../ui/Dialogs.tsx";
import type { EmailData, SocialItem } from "../types.ts";
import { DashedAdd, inputCls, xBtn } from "./parts.tsx";

// Lista de redes do bloco "Redes sociais e contato" (port de buildSocials).
export function SocialList({ social, edit }: { social: EmailData['social'], edit: (fn: (so: EmailData['social']) => void) => void }) {
  const ask = useAsk();
  return (
    <div className="flex flex-col gap-2.5">
      {social.items.map((it, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)_auto] gap-2 p-2.5 rounded-xl border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}>
          <select aria-label="Rede" value={it.rede} onChange={e => { const v = e.target.value; edit(so => { so.items[i].rede = v; }); }} className={inputCls + ' cursor-pointer'}>
            {Object.entries(NETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input aria-label="Link da rede" placeholder="Link do perfil" value={it.link || ''} onChange={e => { const v = e.target.value.trim(); edit(so => { so.items[i].link = v; }); }} className={inputCls} />
          <button type="button" aria-label="Remover rede" className={xBtn} onClick={async () => {
            if (!await ask({ title: 'Remover rede?', message: '“' + (NETS[it.rede] || 'Rede') + '” sairá do bloco de redes.', ok: 'Remover', tone: 'danger' })) return;
            edit(so => { so.items.splice(i, 1); });
          }}><X size={14} /></button>
          <input aria-label="Link do ícone" placeholder={MC[it.rede] ? 'Ícone padrão em uso · cole um link para trocar' : 'Cole o link do ícone (PNG hospedado)'} value={it.icon || ''} onChange={e => { const v = e.target.value.trim(); edit(so => { so.items[i].icon = v; }); }} className={inputCls + ' col-span-2 text-xs'} />
          <IconPreview item={it} social={social} />
        </div>
      ))}
      <DashedAdd onClick={() => edit(so => { so.items.push({ rede: 'tiktok', link: '', icon: '' }); })}>Nova rede</DashedAdd>
    </div>
  );
}

function IconPreview({ item, social }: { item: SocialItem, social: EmailData['social'] }) {
  const url = iconOf(item, social);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="w-9 h-9 rounded-lg grid place-items-center overflow-hidden" style={{ background: social.bg }} aria-hidden="true">
      {url && failed !== url && <img src={url} alt="" className="w-6 h-6 object-contain" onError={() => setFailed(url)} />}
    </span>
  );
}
