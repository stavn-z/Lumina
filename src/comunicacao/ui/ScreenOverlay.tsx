import { createPortal } from "react-dom";
import type { MouseEventHandler, ReactNode } from "react";

// Fundo escuro dos popups da Comunicação, renderizado no body (como o ClientDetailModal).
// A área abre dentro do OverlayModal, cujo painel mantém o transform da animação de entrada;
// isso prende qualquer "fixed inset-0" dentro do painel e deixava a borda dele sem escurecer.
export function ScreenOverlay({ className, onClick, children }: { className: string, onClick?: MouseEventHandler<HTMLDivElement>, children: ReactNode }) {
  return createPortal(
    <div className={`fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center fade-in ${className}`} onClick={onClick}>
      {children}
    </div>,
    document.body,
  );
}
