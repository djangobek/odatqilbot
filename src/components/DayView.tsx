'use client';
import { useEffect, useState } from 'react';
import { Check, ChevronDown, SkipForward } from 'lucide-react';
import clsx from 'clsx';
import { api, useApi } from '@/lib/api';
import { t } from '@/lib/i18n';
import { timeOf } from '@/lib/format';
import type { DayItem } from '@/lib/stats';
import type { DayResponse } from '@/server/queries';
import { useMe } from './AuthProvider';

type Props = { date: string; onChanged?: () => void; onCreate?: () => void; refreshKey?: number };

export function DayView({ date, onChanged, onCreate, refreshKey = 0 }: Props) {
  const { me, toast } = useMe();
  const { data, setData, error, loading, reload } = useApi<DayResponse>(`/api/day/${date}`);
  const [showDone, setShowDone] = useState(true);
  useEffect(() => { if (refreshKey) reload(); }, [refreshKey, reload]);

  if (loading)
    return (
      <div className="space-y-2" role="status" aria-label={t.loading}>
        <div className="skeleton h-24" /><div className="skeleton h-16" /><div className="skeleton h-16" /><div className="skeleton h-16" />
      </div>
    );
  if (error || !data)
    return (
      <div className="py-10 text-center">
        <p className="text-muted">{error ?? t.error}</p>
        <button onClick={reload} className="mt-3 rounded-full bg-raised px-5 py-2.5 font-semibold">{t.retry}</button>
      </div>
    );

  const { day } = data;
  const editable = date <= me.today;
  const counted = day.completed + day.missed + day.pending;
  const todo = day.items.filter((i) => i.status !== 'COMPLETED');
  const done = day.items.filter((i) => i.status === 'COMPLETED');

  async function setStatus(item: DayItem, status: 'PENDING' | 'COMPLETED' | 'SKIPPED') {
    if (!editable) return;
    const before = data;
    // optimistic update; server stays the source of truth
    setData((d) => {
      if (!d) return d;
      const items = d.day.items.map((i) => (i.habitId === item.habitId ? { ...i, status, completedAt: status === 'COMPLETED' ? Date.now() : null } : i));
      const completed = items.filter((i) => i.status === 'COMPLETED').length;
      const skipped = items.filter((i) => i.status === 'SKIPPED').length;
      const rest = items.length - completed - skipped;
      const isPast = date < me.today;
      return { ...d, day: { ...d.day, items, completed, skipped, missed: isPast ? rest : 0, pending: isPast ? 0 : rest } };
    });
    try {
      await api('/api/records', { method: 'POST', body: { habitId: item.habitId, date, status } });
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      reload();
      onChanged?.();
    } catch (e) {
      setData(before);
      toast((e as Error).message, 'err');
    }
  }

  if (data.activeHabits === 0 && day.items.length === 0)
    return (
      <div className="py-16 text-center">
        <p className="text-xl font-bold">{t.noHabitsTitle}</p>
        <p className="mx-auto mt-2 max-w-xs text-muted">{t.noHabitsText}</p>
        {onCreate && <button onClick={onCreate} className="mt-6 rounded-full bg-accent px-6 py-3 font-bold text-black">{t.createFirst}</button>}
      </div>
    );

  return (
    <div>
      {day.scheduled > 0 && (
        <section className="mb-4 rounded-xl2 bg-surface p-4" aria-label={t.dayProgress}>
          <div className="flex items-end justify-between">
            <p className="text-lg font-bold">{day.completed} / {counted} <span className="text-base font-medium text-muted">{t.habitsDone}</span></p>
            <p className="text-2xl font-extrabold text-accent">{day.percent ?? 0}%</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={day.percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${day.percent ?? 0}%` }} />
          </div>
          {day.missed > 0 && <p className="mt-2 text-sm text-muted">{t.missed}: {day.missed}</p>}
          {day.skipped > 0 && <p className="text-sm text-muted">{t.skipped}: {day.skipped}</p>}
          {date === me.today && day.pending === 0 && day.completed > 0 && <p className="mt-2 text-sm text-ok">{t.allDone}</p>}
        </section>
      )}

      {day.scheduled === 0 && (
        <div className="py-12 text-center">
          <p className="text-xl font-bold">{t.freeDay}</p>
          <p className="mt-1 text-muted">{t.freeDayText}</p>
        </div>
      )}

      <ul className="space-y-2">{todo.map((i) => <Row key={i.habitId} item={i} date={date} editable={editable} tz={me.user.timezone} onSet={setStatus} />)}</ul>

      {done.length > 0 && (
        <section className="mt-5">
          <button onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="flex w-full items-center justify-between px-2 py-2 font-semibold">
            {t.completed}
            <span className="flex items-center gap-1 text-muted">{done.length}<ChevronDown size={18} className={clsx('transition-transform', !showDone && '-rotate-90')} /></span>
          </button>
          {showDone && <ul className="mt-1 space-y-2">{done.map((i) => <Row key={i.habitId} item={i} date={date} editable={editable} tz={me.user.timezone} onSet={setStatus} />)}</ul>}
        </section>
      )}

      <NoteEditor date={date} initial={data.note} editable={editable} />
    </div>
  );
}

function Row({ item, editable, tz, onSet }: { item: DayItem; date: string; editable: boolean; tz: string; onSet: (i: DayItem, s: 'PENDING' | 'COMPLETED' | 'SKIPPED') => void }) {
  const done = item.status === 'COMPLETED';
  const skipped = item.status === 'SKIPPED';
  return (
    <li className={clsx('flex items-center gap-3 rounded-2xl bg-surface px-3 py-3', (done || skipped) && 'opacity-60')}>
      <button disabled={!editable} onClick={() => onSet(item, done ? 'PENDING' : 'COMPLETED')} aria-pressed={done}
        aria-label={`${item.name}: ${done ? t.completed : t.todo}`}
        className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 transition-colors active:scale-95 disabled:opacity-50', done ? 'pop border-accent bg-accent text-black' : 'border-[#4a4a4f]')}>
        {done && <Check size={22} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={clsx('truncate font-semibold', done && 'line-through')}>{item.icon && <span className="mr-1.5">{item.icon}</span>}{item.name}</p>
        <p className="truncate text-xs text-muted">
          {[item.time, item.archived ? t.archive : null, skipped ? t.skipped : null, done && item.completedAt ? `${t.completionTime}: ${timeOf(item.completedAt, tz)}` : null, !done && !skipped && item.outcome === 'missed' ? t.missed : null].filter(Boolean).join(' · ') || item.description || ' '}
        </p>
      </div>
      {editable && !done && (
        <button onClick={() => onSet(item, skipped ? 'PENDING' : 'SKIPPED')} aria-label={skipped ? t.unskip : t.skip} title={skipped ? t.unskip : t.skip}
          className={clsx('grid h-11 w-11 place-items-center rounded-full active:scale-95', skipped ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-raised')}>
          <SkipForward size={18} />
        </button>
      )}
    </li>
  );
}

function NoteEditor({ date, initial, editable }: { date: string; initial: DayResponse['note']; editable: boolean }) {
  const { toast } = useMe();
  // Initialised once per day (DayView is keyed by date); later reloads must never overwrite what is being typed.
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(Boolean(initial.wentWell || initial.difficult || initial.notes));
  const dirty = v.wentWell !== saved.wentWell || v.difficult !== saved.difficult || v.notes !== saved.notes;
  const ta = 'w-full resize-none rounded-xl border border-line bg-raised p-3 text-base outline-none focus:border-accent disabled:opacity-70';

  async function save() {
    setBusy(true);
    try {
      await api('/api/notes', { method: 'PUT', body: { date, wentWell: v.wentWell, difficult: v.difficult, notes: v.notes } });
      setSaved(v);
      toast(t.saved);
    } catch (e) { toast((e as Error).message, 'err'); }
    finally { setBusy(false); }
  }
  return (
    <section className="mt-6 rounded-xl2 bg-surface p-4">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between font-semibold">
        {t.notes}<ChevronDown size={18} className={clsx('text-muted transition-transform', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {([['wentWell', t.wentWell], ['difficult', t.difficult], ['notes', t.observations]] as const).map(([k, label]) => (
            <label key={k} className="block"><span className="mb-1 block text-xs text-muted">{label}</span>
              <textarea rows={2} className={ta} disabled={!editable} maxLength={1000} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
          ))}
          {editable && (
            <button onClick={save} disabled={busy || !dirty} className={clsx('h-12 w-full rounded-2xl font-semibold transition-colors active:scale-[.98] disabled:opacity-50', dirty ? 'bg-accent text-black' : 'bg-raised')}>
              {busy ? t.loading : t.save}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
