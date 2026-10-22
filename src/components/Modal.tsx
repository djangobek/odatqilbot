'use client';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { t } from '@/lib/i18n';

/** Visible area of the page: shrinks when the on-screen keyboard opens (and follows Telegram's expandable viewport). */
function useVisibleViewport() {
  const [v, setV] = useState<{ h: number; top: number; keyboard: boolean } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      const h = vv?.height ?? window.innerHeight;
      setV({ h, top: vv?.offsetTop ?? 0, keyboard: window.innerHeight - h > 120 });
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return v;
}

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Pinned under the scrolling body (e.g. the Save button), so it is always reachable. */
  footer?: React.ReactNode;
  /** "sheet": bottom sheet on phones. "dialog": small centered card (like an "Add section" prompt). */
  variant?: 'sheet' | 'dialog';
  /** Focus the first field on open. Off for big forms: it would pop the keyboard up and cover half the sheet. */
  autoFocus?: boolean;
};

export function Modal({ title, onClose, children, footer, variant = 'sheet', autoFocus }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // keep the latest handler without re-running the effect on every parent render
  const vp = useVisibleViewport();
  const dialog = variant === 'dialog';
  const focusFirst = autoFocus ?? dialog;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    if (focusFirst) ref.current?.querySelector<HTMLElement>('input,textarea')?.focus({ preventScroll: true });
    else ref.current?.focus({ preventScroll: true });
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
  }, [focusFirst]);

  // The overlay is exactly the visible viewport, so the panel can never be taller than what the person can see.
  const frame = vp ? { top: vp.top, height: vp.h } : { top: 0, height: '100dvh' };

  return (
    <div className="fixed inset-x-0 z-50 bg-black/70 backdrop-blur-[2px]" style={frame}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={clsx('flex h-full justify-center', dialog ? 'items-center px-4' : 'items-end md:items-center md:px-4')}
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
          className={clsx('sheet-in flex w-full max-w-md flex-col overflow-hidden border border-line bg-surface outline-none',
            dialog ? 'max-h-[calc(100%-1rem)] rounded-[28px]' : 'max-h-[calc(100%-0.5rem)] rounded-t-[28px] md:rounded-[28px]')}>
          <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
            <h2 className={clsx('text-lg font-bold', dialog && 'flex-1 text-center')}>{title}</h2>
            {!dialog && (
              <button type="button" onClick={onClose} aria-label={t.close} className="grid h-10 w-10 place-items-center rounded-full bg-raised active:scale-95"><X size={18} /></button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 pt-1">{children}</div>
          {footer && (
            <div className={clsx('shrink-0 border-t border-line/60 bg-surface px-5 pt-3', vp?.keyboard ? 'pb-3' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4')}>
              {footer}
            </div>
          )}
          {!footer && <div className={vp?.keyboard ? 'h-2' : 'h-[calc(0.5rem+env(safe-area-inset-bottom))] md:h-3'} />}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, text, confirmLabel, onConfirm, onClose }: { title: string; text: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} variant="dialog"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="h-12 flex-1 rounded-2xl bg-raised font-semibold active:scale-[.98]">{t.cancel}</button>
          <button onClick={onConfirm} className="h-12 flex-1 rounded-2xl bg-bad font-semibold text-black active:scale-[.98]">{confirmLabel}</button>
        </div>
      }>
      <p className="py-2 text-center text-muted">{text}</p>
    </Modal>
  );
}
