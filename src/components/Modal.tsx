'use client';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { t } from '@/lib/i18n';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // keep the latest handler without re-running the effect on every parent render

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,textarea,button[type="submit"],button')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),input,textarea,select,[href]')];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-[2px] md:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className="sheet-in max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] border border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-[28px] md:pb-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t.close} className="grid h-11 w-11 place-items-center rounded-full bg-raised active:scale-95"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onClose }: { title: string; text: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-muted">{text}</p>
      <div className="mt-5 flex gap-3">
        <button onClick={onClose} className="h-12 flex-1 rounded-2xl bg-raised font-semibold active:scale-[.98]">{t.cancel}</button>
        <button onClick={onConfirm} className="h-12 flex-1 rounded-2xl bg-bad font-semibold text-black active:scale-[.98]">{confirmLabel}</button>
      </div>
    </Modal>
  );
}
