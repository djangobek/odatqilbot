'use client';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { t } from '@/lib/i18n';
import { success, tap } from '@/lib/haptics';
import { Modal } from './Modal';

const PRESETS = [5, 10, 15, 20, 25, 45];
const R = 54;
const C = 2 * Math.PI * R;

/** "20 daqiqa kitob" -> 20 (so the timer starts with the duration written in the habit's name). */
export function minutesFromName(name: string): number | null {
  const m = name.match(/(\d{1,3})\s*(daqiqa|daq|min|мин)/i);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 180 ? n : null;
}

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function FocusTimer({ name, onComplete, onClose }: { name: string; onComplete: () => void; onClose: () => void }) {
  const [minutes, setMinutes] = useState(minutesFromName(name) ?? 20);
  const total = minutes * 60_000;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    // Based on the wall clock, so a throttled background tab still finishes at the right time.
    const id = window.setInterval(() => {
      const rest = endAt.current - Date.now();
      if (rest <= 0) { setLeft(0); setRunning(false); setFinished(true); success(); }
      else setLeft(rest);
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);

  const pick = (m: number) => { tap(); setMinutes(m); setLeft(m * 60_000); setRunning(false); setFinished(false); };
  const start = () => { tap(); endAt.current = Date.now() + left; setRunning(true); };
  const pause = () => { tap(); setRunning(false); };
  const reset = () => { tap(); setRunning(false); setFinished(false); setLeft(total); };
  const pct = total ? 1 - left / total : 0;

  return (
    <Modal title={t.focus} onClose={onClose} variant="dialog"
      footer={finished ? (
        <button onClick={onComplete} className="h-12 w-full rounded-full bg-accent font-bold text-black active:scale-[.98]">{t.markDone}</button>
      ) : (
        <div className="flex gap-3">
          <button onClick={reset} aria-label={t.focusReset} className="grid h-12 w-14 place-items-center rounded-full bg-raised active:scale-95"><RotateCcw size={20} /></button>
          {running
            ? <button onClick={pause} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-raised font-bold active:scale-[.98]"><Pause size={20} />{t.focusPause}</button>
            : <button onClick={start} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent font-bold text-black active:scale-[.98]"><Play size={20} />{t.focusStart}</button>}
        </div>
      )}>
      <p className="truncate px-2 text-center text-sm text-muted">{name}</p>
      <div className={clsx('relative mx-auto my-3 h-44 w-44 rounded-full', running && 'glow')}>
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="64" cy="64" r={R} fill="none" stroke="#2a2a2d" strokeWidth="9" />
          <circle cx="64" cy="64" r={R} fill="none" stroke="#f08a31" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset .3s linear' }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center" role="timer" aria-live="off">
          <div>
            <p className="text-4xl font-extrabold tabular-nums">{fmt(left)}</p>
            {finished && <p className="mt-1 text-sm font-semibold text-ok">{t.focusDone}</p>}
          </div>
        </div>
      </div>
      <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto pb-1">
        {PRESETS.map((m) => (
          <button key={m} onClick={() => pick(m)} aria-pressed={minutes === m} disabled={running}
            className={clsx('h-9 shrink-0 rounded-full px-3 text-sm font-semibold disabled:opacity-50', minutes === m ? 'bg-accent-soft text-accent' : 'bg-raised text-muted')}>{m}</button>
        ))}
      </div>
      <p className="mt-1 text-center text-xs text-muted">{t.minutes}</p>
    </Modal>
  );
}
