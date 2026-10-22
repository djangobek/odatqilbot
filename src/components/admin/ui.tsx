'use client';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const fmtNum = (n: number) => new Intl.NumberFormat('uz-UZ').format(n).replaceAll('\u00a0', ' ');

export function timeAgo(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return 'hech qachon';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'hozir';
  if (s < 3600) return `${Math.floor(s / 60)} daqiqa oldin`;
  if (s < 86400) return `${Math.floor(s / 3600)} soat oldin`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} kun oldin`;
  return new Date(ms).toLocaleDateString('uz-UZ');
}

export const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, hint, children, className }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-xl2 border border-line bg-surface p-4', className)}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{title}</h2>
          {hint && <span className="text-xs text-muted/70">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'accent' | 'ok' | 'bad' }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={clsx('mt-1.5 text-3xl font-extrabold tabular-nums', tone === 'accent' && 'text-accent', tone === 'ok' && 'text-ok', tone === 'bad' && 'text-bad')}>
        {typeof value === 'number' ? fmtNum(value) : value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'accent' | 'ok' | 'bad' }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
      tone === 'muted' && 'bg-raised text-muted', tone === 'accent' && 'bg-accent-soft text-accent',
      tone === 'ok' && 'bg-ok/15 text-ok', tone === 'bad' && 'bg-bad/15 text-bad')}>
      {children}
    </span>
  );
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? 'bg-accent' : 'bg-raised')}>
      <span className={clsx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function Btn({ children, onClick, tone = 'default', disabled, className, type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; tone?: 'default' | 'primary' | 'danger'; disabled?: boolean; className?: string; type?: 'button' | 'submit';
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={clsx('inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50',
        tone === 'primary' && 'bg-accent text-black hover:bg-accent-strong', tone === 'danger' && 'bg-bad/15 text-bad hover:bg-bad/25',
        tone === 'default' && 'bg-raised text-white hover:bg-line', className)}>
      {children}
    </button>
  );
}

export const inputCls = 'w-full rounded-xl border border-line bg-ink px-3.5 py-2.5 text-white placeholder:text-muted/60 focus:border-accent focus:outline-none';

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl2 border border-bad/30 bg-bad/10 p-4 text-sm">
      <p className="font-semibold text-bad">{message}</p>
      {onRetry && <button onClick={onRetry} className="mt-2 font-semibold underline">Qayta urinish</button>}
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button aria-label="Oldingi" disabled={page <= 1} onClick={() => onPage(page - 1)} className="grid h-9 w-9 place-items-center rounded-full bg-raised disabled:opacity-40"><ChevronLeft size={18} /></button>
      <span className="tabular-nums text-muted">{page} / {pages}</span>
      <button aria-label="Keyingi" disabled={page >= pages} onClick={() => onPage(page + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-raised disabled:opacity-40"><ChevronRight size={18} /></button>
    </div>
  );
}
