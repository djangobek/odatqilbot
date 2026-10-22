'use client';
import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Flame, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useMe, type Section } from '@/components/AuthProvider';
import { Confetti } from '@/components/Confetti';
import { DayView, type SectionFilter } from '@/components/DayView';
import { HabitSheet } from '@/components/HabitSheet';
import { ConfirmDialog, Modal } from '@/components/Modal';
import { MonthCalendar } from '@/components/MonthCalendar';
import { SectionDialog } from '@/components/SectionDialog';
import { Fab } from '@/components/Shell';
import { WeekStrip } from '@/components/WeekStrip';
import { api, useApi } from '@/lib/api';
import { dayTitle, longDate } from '@/lib/format';
import { success, tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { levelOf, quoteOfDay } from '@/lib/quotes';
import type { StatsResult } from '@/lib/stats';

const FILTER_KEY = 'dos_section';
const loadFilter = (): SectionFilter => {
  try {
    const v = sessionStorage.getItem(FILTER_KEY);
    return v && v !== 'all' && Number.isInteger(Number(v)) ? Number(v) : 'all';
  } catch { return 'all'; }
};

export default function TodayPage() {
  const { me, toast, sections, reloadSections } = useMe();
  const [date, setDate] = useState(me.today);
  const [creating, setCreating] = useState(false);
  const [key, setKey] = useState(0);
  const [month, setMonth] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [filter, setFilterState] = useState<SectionFilter>('all');
  const [dialog, setDialog] = useState<'new' | Section | null>(null);
  const [menu, setMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const stats = useApi<StatsResult & { hasData: boolean }>('/api/stats?range=all');
  const first = me.user.displayName.split(' ')[0];

  // After midnight (or a timezone change) jump back to the new "today" instead of showing a stale day.
  useEffect(() => { setDate(me.today); }, [me.today]);
  useEffect(() => { setFilterState(loadFilter()); }, []);
  // A deleted section must not stay selected.
  useEffect(() => {
    if (typeof filter === 'number' && !sections.some((s) => s.id === filter)) setFilterState('all');
  }, [sections, filter]);

  const setFilter = (f: SectionFilter) => {
    tap();
    setFilterState(f);
    try { sessionStorage.setItem(FILTER_KEY, String(f)); } catch { /* ignore */ }
  };
  const current = typeof filter === 'number' ? sections.find((s) => s.id === filter) ?? null : null;
  const reloadStats = stats.reload;
  const onChanged = useCallback(() => reloadStats(), [reloadStats]);

  async function removeSection(s: Section) {
    try {
      await api(`/api/sections/${s.id}`, { method: 'DELETE' });
      await reloadSections();
      setDeleting(false);
      setFilter('all');
      setKey((k) => k + 1);
      toast(t.saved);
    } catch (e) { toast((e as Error).message, 'err'); }
  }

  const o = stats.data?.hasData ? stats.data.overview : null;
  const lv = o ? levelOf(o.completed) : null;

  return (
    <>
      <header className="relative mb-3 text-center">
        <p className="text-sm text-muted">{date === me.today ? `${t.hello}, ${first}` : longDate(date)}</p>
        <h1 className="text-2xl font-extrabold">{dayTitle(date, me.today)}</h1>
        {date !== me.today && <button onClick={() => setDate(me.today)} className="mt-1 text-sm text-accent">{t.goToday}</button>}
        <button onClick={() => { tap(); setMonth((m) => !m); }} aria-pressed={month} aria-label={t.calendarToggle}
          className={clsx('absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full active:scale-95', month ? 'bg-accent text-black' : 'bg-surface text-muted')}>
          <CalendarDays size={20} />
        </button>
        {o && o.currentStreak > 0 && (
          <span className="absolute left-0 top-1 flex h-9 items-center gap-1 rounded-full bg-accent-soft px-3 text-sm font-bold text-accent" aria-label={`${t.currentStreak}: ${o.currentStreak}`}>
            <Flame size={16} />{o.currentStreak}
          </span>
        )}
      </header>

      {lv && o && (
        <section className="mb-4 flex items-center gap-3 rounded-xl2 bg-surface px-4 py-3" aria-label={t.level}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-extrabold text-black">{lv.level}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{t.level} {lv.level} · {t.levelTitles[Math.min(lv.level - 1, t.levelTitles.length - 1)]}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.round(lv.progress * 100)}%` }} /></div>
            <p className="mt-1 truncate text-xs text-muted">{o.completed} {t.completions} · {lv.to - o.completed} {t.toNext}</p>
          </div>
        </section>
      )}

      <div className="no-scrollbar -mx-4 mb-3 flex items-center gap-2 overflow-x-auto px-4" role="tablist" aria-label={t.section}>
        <SectionChip on={filter === 'all'} onClick={() => setFilter('all')}>{t.allSections}</SectionChip>
        {sections.map((s) => <SectionChip key={s.id} on={filter === s.id} onClick={() => setFilter(s.id)}>{s.name}</SectionChip>)}
        <button onClick={() => { tap(); setDialog('new'); }} aria-label={t.addSection} title={t.addSection}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted active:scale-95"><Plus size={22} /></button>
        {current && (
          <button onClick={() => setMenu(true)} aria-label={current.name} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-muted active:scale-95"><MoreHorizontal size={20} /></button>
        )}
      </div>

      {month
        ? <MonthCalendar selected={date} refreshKey={key} onSelect={(d) => { setDate(d); setMonth(false); }} />
        : <WeekStrip selected={date} today={me.today} onSelect={setDate} />}

      {date === me.today && filter === 'all' && <p className="mb-4 px-2 text-center text-sm italic text-muted">“{quoteOfDay(me.today)}”</p>}

      <DayView key={date} date={date} refreshKey={key} section={filter} onChanged={onChanged}
        onAllDone={() => { success(); setConfetti(true); }} onCreate={() => setCreating(true)} />
      <Fab onClick={() => setCreating(true)} label={t.newHabit} />

      {creating && <HabitSheet defaultSectionId={current?.id ?? null} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setKey((k) => k + 1); reloadStats(); }} />}
      {dialog && <SectionDialog section={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} onDone={(s) => { setDialog(null); setFilter(s.id); }} />}
      {menu && current && (
        <Modal title={current.name} variant="dialog" onClose={() => setMenu(false)}>
          <div className="space-y-2 py-2">
            <button onClick={() => { setMenu(false); setDialog(current); }} className="flex h-12 w-full items-center gap-3 rounded-2xl bg-raised px-4 font-semibold active:scale-[.98]"><Pencil size={18} />{t.renameSection}</button>
            <button onClick={() => { setMenu(false); setDeleting(true); }} className="flex h-12 w-full items-center gap-3 rounded-2xl bg-raised px-4 font-semibold text-bad active:scale-[.98]"><Trash2 size={18} />{t.deleteSection}</button>
          </div>
        </Modal>
      )}
      {deleting && current && <ConfirmDialog title={t.deleteSectionTitle} text={t.deleteSectionText} confirmLabel={t.remove} onConfirm={() => removeSection(current)} onClose={() => setDeleting(false)} />}
      {confetti && <Confetti onDone={() => setConfetti(false)} />}
    </>
  );
}

function SectionChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button role="tab" aria-selected={on} onClick={onClick}
      className={clsx('h-10 shrink-0 rounded-full px-4 text-[15px] font-semibold transition-colors active:scale-95', on ? 'bg-accent-soft text-accent ring-1 ring-accent/30' : 'bg-surface text-muted')}>
      {children}
    </button>
  );
}
