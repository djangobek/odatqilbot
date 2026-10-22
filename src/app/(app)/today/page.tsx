'use client';
import { useEffect, useState } from 'react';
import { useMe } from '@/components/AuthProvider';
import { DayView } from '@/components/DayView';
import { HabitSheet } from '@/components/HabitSheet';
import { Fab } from '@/components/Shell';
import { WeekStrip } from '@/components/WeekStrip';
import { dayTitle, longDate } from '@/lib/format';
import { t } from '@/lib/i18n';


export default function TodayPage() {
  const { me } = useMe();
  const [date, setDate] = useState(me.today);
  const [creating, setCreating] = useState(false);
  const [key, setKey] = useState(0);
  const first = me.user.displayName.split(' ')[0];
  // After midnight (or a timezone change) jump back to the new "today" instead of showing a stale day.
  useEffect(() => { setDate(me.today); }, [me.today]);

  return (
    <>
      <header className="mb-3 text-center">
        <p className="text-sm text-muted">{date === me.today ? `${t.hello}, ${first}` : longDate(date)}</p>
        <h1 className="text-2xl font-extrabold">{dayTitle(date, me.today)}</h1>
        {date !== me.today && (
          <button onClick={() => setDate(me.today)} className="mt-1 text-sm text-accent">{t.goToday}</button>
        )}
      </header>
      <WeekStrip selected={date} today={me.today} onSelect={setDate} />
      <DayView key={date} date={date} refreshKey={key} onCreate={() => setCreating(true)} />
      <Fab onClick={() => setCreating(true)} label={t.newHabit} />
      {creating && <HabitSheet onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setKey((k) => k + 1); }} />}
    </>
  );
}
