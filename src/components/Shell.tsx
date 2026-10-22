'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, ListChecks, Repeat } from 'lucide-react';
import clsx from 'clsx';
import { t } from '@/lib/i18n';

const NAV = [
  { href: '/today', label: t.navToday, Icon: ListChecks },
  { href: '/habits', label: t.navHabits, Icon: Repeat },
  { href: '/calendar', label: t.navCalendar, Icon: CalendarDays },
  { href: '/stats', label: t.navStats, Icon: BarChart3 },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-dvh md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-1 border-r border-line p-4 md:flex">
        <p className="mb-6 px-3 text-lg font-bold">Discipline <span className="text-accent">OS</span></p>
        {NAV.map(({ href, label, Icon }) => {
          const on = path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={on ? 'page' : undefined}
              className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors', on ? 'bg-surface text-accent' : 'text-muted hover:bg-surface')}>
              <Icon size={20} /> {label}
            </Link>
          );
        })}
      </aside>

      <main className="mx-auto max-w-2xl px-4 pb-40 pt-[max(env(safe-area-inset-top),1rem)] md:pb-16">{children}</main>

      <nav aria-label={t.mainNav} className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
        <ul className="flex w-full max-w-sm justify-between rounded-full border border-line bg-[#141414]/95 p-1.5 shadow-lg shadow-black/60 backdrop-blur">
          {NAV.map(({ href, label, Icon }) => {
            const on = path.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link href={href} aria-current={on ? 'page' : undefined} aria-label={label}
                  className={clsx('flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors active:scale-95', on ? 'bg-surface text-accent' : 'text-muted')}>
                  <Icon size={20} strokeWidth={on ? 2.4 : 2} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label}
      className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-accent text-black shadow-lg shadow-black/50 transition-transform active:scale-95 md:bottom-8 md:right-8 md:hover:bg-accent-strong">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
    </button>
  );
}
