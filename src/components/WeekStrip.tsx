'use client';
import clsx from 'clsx';
import { addDays, parseDate, weekday } from '@/lib/dates';
import { t } from '@/lib/i18n';

export function WeekStrip({ selected, today, onSelect }: { selected: string; today: string; onSelect: (d: string) => void }) {
  const offset = (weekday(selected) + 6) % 7; // Monday first
  const monday = addDays(selected, -offset);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <div className="mb-4 grid grid-cols-7 text-center" role="group" aria-label={t.weekLabel}>
      {days.map((d) => {
        const isSel = d === selected;
        const isToday = d === today;
        return (
          <button key={d} onClick={() => onSelect(d)} aria-pressed={isSel} aria-label={d} className="flex flex-col items-center gap-1 py-1">
            <span className="text-xs text-muted">{t.weekdayShort[weekday(d)]}</span>
            <span className={clsx('grid h-11 w-11 place-items-center rounded-full text-lg font-semibold transition-colors',
              isSel && isToday && 'bg-accent text-black', isSel && !isToday && 'bg-white text-accent',
              !isSel && isToday && 'text-accent ring-1 ring-accent')}>{parseDate(d).getUTCDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
