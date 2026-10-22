'use client';
import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Minus, X } from 'lucide-react';
import clsx from 'clsx';
import { useMe } from '@/components/AuthProvider';
import { DayView } from '@/components/DayView';
import { useApi } from '@/lib/api';
import { weekday, parseDate } from '@/lib/dates';
import { dayTitle, longDate, monthTitle } from '@/lib/format';
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

export default function CalendarPage() {
  const { me } = useMe();
  const [month, setMonth] = useState(me.today.slice(0, 7));
  const [selected, setSelected] = useState(me.today);
    const { data, refreshing, error, reload } = useApi<{ days: DaySummary[] }>(`/api/calendar?month=${month}`);

  const lead = data ? (weekday(data.days[0].date) + 6) % 7 : 0;

  function goToday() { setMonth(me.today.slice(0, 7)); setSelected(me.today); }

  return (
    <>
      <h1 className="mb-3 text-center text-2xl font-extrabold">{t.calendar}</h1>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex">
          <Nav label={t.prevYear} onClick={() => setMonth(shiftMonth(month, -12))}><ChevronsLeft size={20} /></Nav>
          <Nav label={t.prevMonth} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={20} /></Nav>
        </div>
        <p className="font-bold" aria-live="polite">{monthTitle(month)}</p>
        <div className="flex">
          <Nav label={t.nextMonth} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={20} /></Nav>
          <Nav label={t.nextYear} onClick={() => setMonth(shiftMonth(month, 12))}><ChevronsRight size={20} /></Nav>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => <span key={d} className="py-1">{t.weekdayShort[d]}</span>)}
      </div>

      {error ? (
        <p className="py-10 text-center text-muted">{error} <button onClick={reload} className="text-accent">{t.retry}</button></p>
      ) : (
        <div className={clsx('grid grid-cols-7 gap-1', refreshing && 'opacity-50 transition-opacity')}>
          {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
          {(data?.days ?? []).map((d) => {
            const isSel = d.date === selected;
            return (
              <button key={d.date} onClick={() => setSelected(d.date)} aria-pressed={isSel}
                aria-label={`${longDate(d.date)}: ${d.scheduled ? `${d.completed}/${d.scheduled}` : t.stateNone}`}
                className={clsx('relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold', STYLE[d.state],
                  isSel && 'ring-2 ring-accent', d.date === me.today && 'underline decoration-accent decoration-2 underline-offset-4')}>
                {parseDate(d.date).getUTCDate()}
                <span className="h-3">{GLYPH[d.state]}</span>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1 text-ok"><Check size={12} strokeWidth={3} /> {t.stateComplete}</span>
        <span className="flex items-center gap-1 text-accent"><Minus size={12} strokeWidth={3} /> {t.statePartial}</span>
        <span className="flex items-center gap-1 text-bad"><X size={12} strokeWidth={3} /> {t.stateMissed}</span>
      </p>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-lg font-bold">{dayTitle(selected, me.today)}{selected !== me.today && <span className="ml-2 text-sm font-medium text-muted">{longDate(selected)}</span>}</h2>
        <button onClick={goToday} className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-accent">{t.goToday}</button>
      </div>
      <DayView key={selected} date={selected} onChanged={reload} />
    </>
  );
}

function Nav({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} aria-label={label} className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-surface active:scale-95">{children}</button>;
}
