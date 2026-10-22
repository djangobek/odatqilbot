'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';
import { WEEK_ORDER } from '@/lib/format';
import { success, tap } from '@/lib/haptics';
import { createHabitSchema } from '@/lib/validation';
import type { HabitDef } from '@/lib/schedule';
import { maskAt } from '@/lib/schedule';
import { Modal } from './Modal';
import { useMe } from './AuthProvider';

const ICONS = ['📚', '💧', '🏃', '🧘', '💪', '🌙', '✍️', '🎯', '🗣️', '🍎', '💻', '🛌', '🎧', '🧠', '🙏', '🌿'];
const TIMES = ['06:00', '07:00', '08:00', '12:00', '18:00', '20:00', '21:00', '22:00'];
const field = 'h-12 w-full rounded-2xl border border-line bg-raised px-4 text-base outline-none focus:border-accent';
const chip = (on: boolean) => clsx('h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors active:scale-95', on ? 'bg-accent text-black' : 'bg-raised text-muted');

export function HabitSheet({ habit, defaultSectionId, onClose, onSaved }: { habit?: HabitDef; defaultSectionId?: number | null; onClose: () => void; onSaved: () => void }) {
  const { me, toast, sections } = useMe();
  const [name, setName] = useState(habit?.name ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [icon, setIcon] = useState(habit?.icon ?? '');
  const [category, setCategory] = useState(habit?.category ?? '');
  const [sectionId, setSectionId] = useState<number | null>(habit ? habit.sectionId ?? null : defaultSectionId ?? null);
  const [startDate, setStartDate] = useState(habit?.startDate ?? me.today);
  const [endDate, setEndDate] = useState(habit?.endDate ?? '');
  const [reminderTime, setReminderTime] = useState(habit?.reminderTime ?? '');
  const [mask, setMask] = useState(habit ? maskAt(habit, me.today > habit.startDate ? me.today : habit.startDate) || 127 : 127);
  const [more, setMore] = useState(Boolean(habit && (habit.description || habit.category || habit.endDate)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (d: number) => { tap(); setMask((m) => m ^ (1 << d)); };

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const payload = { name, description, icon, category, sectionId, startDate, endDate, reminderTime, weekdays: mask };
    const parsed = createHabitSchema.safeParse(payload);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? t.error);
    setBusy(true);
    try {
      await api(habit ? `/api/habits/${habit.id}` : '/api/habits', { method: habit ? 'PATCH' : 'POST', body: { ...parsed.data, sectionId } });
      success();
      toast(t.saved);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={habit ? t.editHabit : t.newHabit} onClose={onClose}
      footer={
        <>
          {error && <p role="alert" className="mb-2 text-center text-sm text-bad">{error}</p>}
          <button type="submit" form="habit-form" disabled={busy} className="h-12 w-full rounded-2xl bg-accent font-bold text-black active:scale-[.98] disabled:opacity-60">{busy ? t.loading : t.save}</button>
        </>
      }>
      <form id="habit-form" onSubmit={submit} className="space-y-4 pb-2" noValidate>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.name}</span>
          <input className={field} value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder={t.namePh} maxLength={80} enterKeyHint="done" />
        </label>

        {sections.length > 0 && (
          <div>
            <span className="mb-1 block text-sm text-muted">{t.section}</span>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              <button type="button" aria-pressed={sectionId === null} onClick={() => setSectionId(null)} className={chip(sectionId === null)}>{t.noSection}</button>
              {sections.map((s) => (
                <button type="button" key={s.id} aria-pressed={sectionId === s.id} onClick={() => setSectionId(s.id)} className={chip(sectionId === s.id)}>{s.name}</button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="mb-1 block text-sm text-muted">{t.icon}</span>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {ICONS.map((i) => (
              <button type="button" key={i} aria-pressed={icon === i} onClick={() => setIcon(icon === i ? '' : i)}
                className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-xl', icon === i ? 'border-accent bg-accent-soft' : 'border-line bg-raised')}>{i}</button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm text-muted">{t.repeat}</span>
          <div className="grid grid-cols-7 gap-1">
            {WEEK_ORDER.map((d) => (
              <button type="button" key={d} aria-pressed={((mask >> d) & 1) === 1} onClick={() => toggle(d)}
                className={clsx('h-11 rounded-xl text-sm font-semibold', (mask >> d) & 1 ? 'bg-accent text-black' : 'bg-raised text-muted')}>
                {t.weekdayShort[d]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setMask(127)} className={chip(mask === 127)}>{t.everyDay}</button>
            <button type="button" onClick={() => setMask(0b0111110)} className={chip(mask === 0b0111110)}>{t.workdays}</button>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm text-muted">{t.reminder}</span>
          <div className="flex items-center gap-2">
            <input type="time" className={clsx(field, 'w-32 shrink-0 px-3')} value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} aria-label={t.reminder} />
            <div className="no-scrollbar -mr-5 flex min-w-0 gap-2 overflow-x-auto pr-5">
              {TIMES.map((x) => <button type="button" key={x} onClick={() => setReminderTime(reminderTime === x ? '' : x)} className={chip(reminderTime === x)}>{x}</button>)}
            </div>
          </div>
        </div>

        <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex w-full items-center justify-between rounded-xl px-1 py-1 text-sm font-semibold text-muted">
          {more ? t.lessOptions : t.moreOptions}<ChevronDown size={18} className={clsx('transition-transform', more && 'rotate-180')} />
        </button>
        {more && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-sm text-muted">{t.startDate}</span>
                <input type="date" className={clsx(field, 'px-3')} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-sm text-muted">{t.endDate}</span>
                <input type="date" className={clsx(field, 'px-3')} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
            </div>
            <label className="block"><span className="mb-1 block text-sm text-muted">{t.category}</span>
              <input className={field} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} /></label>
            <label className="block"><span className="mb-1 block text-sm text-muted">{t.description}</span>
              <textarea className={`${field} h-20 py-3`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} /></label>
          </div>
        )}
      </form>
    </Modal>
  );
}
