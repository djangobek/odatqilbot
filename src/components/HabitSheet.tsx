'use client';
import { useState } from 'react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';
import { WEEK_ORDER } from '@/lib/format';
import { createHabitSchema } from '@/lib/validation';
import type { HabitDef } from '@/lib/schedule';
import { maskAt } from '@/lib/schedule';
import { Modal } from './Modal';
import { useMe } from './AuthProvider';

const ICONS = ['📚', '💧', '🏃', '🧘', '💪', '🌙', '✍️', '🎯', '🗣️', '🍎', '💻', '🛌'];
const field = 'h-12 w-full rounded-2xl border border-line bg-raised px-4 text-base outline-none focus:border-accent';

export function HabitSheet({ habit, onClose, onSaved }: { habit?: HabitDef; onClose: () => void; onSaved: () => void }) {
  const { me, toast } = useMe();
  const [name, setName] = useState(habit?.name ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [icon, setIcon] = useState(habit?.icon ?? '');
  const [category, setCategory] = useState(habit?.category ?? '');
  const [startDate, setStartDate] = useState(habit?.startDate ?? me.today);
  const [endDate, setEndDate] = useState(habit?.endDate ?? '');
  const [reminderTime, setReminderTime] = useState(habit?.reminderTime ?? '');
  const [mask, setMask] = useState(habit ? maskAt(habit, me.today > habit.startDate ? me.today : habit.startDate) || 127 : 127);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (d: number) => setMask((m) => m ^ (1 << d));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name, description, icon, category, startDate, endDate, reminderTime, weekdays: mask };
    const parsed = createHabitSchema.safeParse(payload);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? t.error);
    setBusy(true);
    try {
      await api(habit ? `/api/habits/${habit.id}` : '/api/habits', { method: habit ? 'PATCH' : 'POST', body: parsed.data });
      toast(t.saved);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={habit ? t.editHabit : t.newHabit} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{t.name}</span>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} maxLength={80} />
        </label>

        <div>
          <span className="mb-1 block text-sm text-muted">{t.icon}</span>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((i) => (
              <button type="button" key={i} aria-pressed={icon === i} onClick={() => setIcon(icon === i ? '' : i)}
                className={clsx('grid h-11 w-11 place-items-center rounded-xl border text-xl', icon === i ? 'border-accent bg-accent-soft' : 'border-line bg-raised')}>{i}</button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm text-muted">{t.repeat}</span>
          <div className="flex justify-between gap-1">
            {WEEK_ORDER.map((d) => (
              <button type="button" key={d} aria-pressed={((mask >> d) & 1) === 1} onClick={() => toggle(d)}
                className={clsx('h-11 flex-1 rounded-xl text-sm font-semibold', (mask >> d) & 1 ? 'bg-accent text-black' : 'bg-raised text-muted')}>
                {t.weekdayShort[d]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2 text-sm">
            <button type="button" onClick={() => setMask(127)} className="rounded-full bg-raised px-3 py-1">{t.everyDay}</button>
            <button type="button" onClick={() => setMask(0b0111110)} className="rounded-full bg-raised px-3 py-1">{t.workdays}</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-sm text-muted">{t.reminder}</span>
            <input type="time" className={field} value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-sm text-muted">{t.category}</span>
            <input className={field} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-sm text-muted">{t.startDate}</span>
            <input type="date" className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-sm text-muted">{t.endDate}</span>
            <input type="date" className={field} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        </div>
        <label className="block"><span className="mb-1 block text-sm text-muted">{t.description}</span>
          <textarea className={`${field} h-20 py-3`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} /></label>

        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <button type="submit" disabled={busy} className="h-12 w-full rounded-2xl bg-accent font-bold text-black active:scale-[.98] disabled:opacity-60">{busy ? t.loading : t.save}</button>
      </form>
    </Modal>
  );
}
