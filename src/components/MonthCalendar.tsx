'use client';
import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Minus, X } from 'lucide-react';
import clsx from 'clsx';
import { useMe } from '@/components/AuthProvider';
import { useApi } from '@/lib/api';
import { weekday, parseDate } from '@/lib/dates';
import { longDate, monthTitle } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { DaySummary, DayState } from '@/lib/stats';

function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const STYLE: Record<DayState, string> = {
  complete: 'bg-ok/20 text-ok', partial: 'bg-accent-soft text-accent', missed: 'bg-bad/15 text-bad',
  open: 'bg-raised text-white', none: 'text-muted', skipped: 'text-muted', future: 'text-[#6e6e73]',
};
const GLYPH: Partial<Record<DayState, React.ReactNode>> = {
  complete: <Check size={12} strokeWidth={3} />, partial: <Minus size={12} strokeWidth={3} />, missed: <X size={12} strokeWidth={3} />,
};

/** Month grid with a colour per day (used inside the Today page; replaces the old Calendar tab). */
export function MonthCalendar({ selected, onSelect, refreshKey = 0 }: { selected: string; onSelect: (d: string) => void; refreshKey?: number }) {
  const { me } = useMe();
  const [month, setMonth] = useState(selected.slice(0, 7));
  const { data, refreshing, error, reload } = useApi<{ days: DaySummary[] }>(`/api/calendar?month=${month}&k=${refreshKey}`);
  const lead = data ? (weekday(data.days[0].date) + 6) % 7 : 0;

  return (
    <section className="mb-4 rounded-xl2 bg-surface p-3" aria-label={t.calendarToggle}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex"><Nav label={t.prevYear} onClick={() => setMonth(shiftMonth(month, -12))}><ChevronsLeft size={18} /></Nav><Nav label={t.prevMonth} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></Nav></div>
        <p className="font-bold" aria-live="polite">{monthTitle(month)}</p>
        <div className="flex"><Nav label={t.nextMonth} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></Nav><Nav label={t.nextYear} onClick={() => setMonth(shiftMonth(month, 12))}><ChevronsRight size={18} /></Nav></div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => <span key={d} className="py-1">{t.weekdayShort[d]}</span>)}
      </div>
      {error ? (
        <p className="py-8 text-center text-muted">{error} <button onClick={reload} className="text-accent">{t.retry}</button></p>
      ) : (
        <div className={clsx('grid grid-cols-7 gap-1', refreshing && 'opacity-50 transition-opacity')}>
          {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
          {(data?.days ?? []).map((d) => (
            <button key={d.date} onClick={() => onSelect(d.date)} aria-pressed={d.date === selected}
              aria-label={`${longDate(d.date)}: ${d.scheduled ? `${d.completed}/${d.scheduled}` : t.stateNone}`}
              className={clsx('relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold', STYLE[d.state],
                d.date === selected && 'ring-2 ring-accent', d.date === me.today && 'underline decoration-accent decoration-2 underline-offset-4')}>
              {parseDate(d.date).getUTCDate()}
              <span className="h-3">{GLYPH[d.state]}</span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1 text-ok"><Check size={12} strokeWidth={3} /> {t.stateComplete}</span>
        <span className="flex items-center gap-1 text-accent"><Minus size={12} strokeWidth={3} /> {t.statePartial}</span>
        <span className="flex items-center gap-1 text-bad"><X size={12} strokeWidth={3} /> {t.stateMissed}</span>
      </p>
    </section>
  );
}

function Nav({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} aria-label={label} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-raised active:scale-95">{children}</button>;
}
