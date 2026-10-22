'use client';
import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import clsx from 'clsx';
import { Flame, Lock } from 'lucide-react';
import { useApi } from '@/lib/api';
import { parseDate, weekday } from '@/lib/dates';
import { t } from '@/lib/i18n';
import type { StatsResult } from '@/lib/stats';

type R = '7d' | '30d' | 'month' | 'all';
type Resp = StatsResult & { hasData: boolean };
const RANGES: { k: R; label: string }[] = [
  { k: '7d', label: t.last7 }, { k: '30d', label: t.last30 }, { k: 'month', label: t.thisMonth }, { k: 'all', label: t.allTime },
];
const short = (d: string) => `${parseDate(d).getUTCDate()}.${String(parseDate(d).getUTCMonth() + 1).padStart(2, '0')}`;

const BADGES = [
  { id: 'first', emoji: '🌱', title: 'Birinchi qadam', hint: '1 ta bajarilish', test: (a: Resp) => a.overview.completed >= 1 },
  { id: 's3', emoji: '🔥', title: '3 kun', hint: '3 kunlik seriya', test: (a: Resp) => a.overview.bestStreak >= 3 },
  { id: 's7', emoji: '⚡', title: 'Hafta qahramoni', hint: '7 kunlik seriya', test: (a: Resp) => a.overview.bestStreak >= 7 },
  { id: 's14', emoji: '🚀', title: '2 hafta', hint: '14 kunlik seriya', test: (a: Resp) => a.overview.bestStreak >= 14 },
  { id: 's30', emoji: '👑', title: 'Oy ustasi', hint: '30 kunlik seriya', test: (a: Resp) => a.overview.bestStreak >= 30 },
  { id: 'c50', emoji: '💪', title: '50 bajarilish', hint: '50 ta bajarilish', test: (a: Resp) => a.overview.completed >= 50 },
  { id: 'c200', emoji: '🏆', title: '200 bajarilish', hint: '200 ta bajarilish', test: (a: Resp) => a.overview.completed >= 200 },
  { id: 'perfect', emoji: '💯', title: 'Mukammal kun', hint: 'Bir kunda 100%', test: (a: Resp) => a.daily.some((d) => d.percent === 100) },
  { id: 'perfectweek', emoji: '🌟', title: 'Mukammal hafta', hint: '7 kun ketma-ket 100%', test: (a: Resp) => { let run = 0; for (const d of a.daily) { run = d.percent === 100 ? run + 1 : d.percent === null ? run : 0; if (run >= 7) return true; } return false; } },
];

/** Average completion per weekday (needs ~2 weeks of data to say anything useful). */
function weekdayInsight(daily: { date: string; percent: number | null }[]) {
  const sum = Array(7).fill(0), n = Array(7).fill(0);
  for (const d of daily) if (d.percent !== null) { const w = weekday(d.date); sum[w] += d.percent; n[w]++; }
  const rows = [0, 1, 2, 3, 4, 5, 6].filter((w) => n[w] >= 2).map((w) => ({ w, avg: Math.round(sum[w] / n[w]) }));
  if (rows.length < 4) return null;
  rows.sort((a, b) => b.avg - a.avg);
  return { best: rows[0], worst: rows[rows.length - 1] };
}

export default function StatsPage() {
  const [range, setRange] = useState<R>('7d');
  const { data, loading, refreshing, error, reload } = useApi<Resp>(`/api/stats?range=${range}`);
  const all = useApi<Resp>('/api/stats?range=all');
  const insight = all.data?.hasData ? weekdayInsight(all.data.daily) : null;

  return (
    <>
      <h1 className="mb-4 text-center text-2xl font-extrabold">{t.stats}</h1>
      <div className="mb-2 grid grid-cols-4 rounded-full bg-surface p-1" role="tablist">
        {RANGES.map(({ k, label }) => (
          <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)}
            className={clsx('h-10 rounded-full text-sm font-semibold transition-colors', range === k ? 'bg-raised text-accent' : 'text-muted')}>{label}</button>
        ))}
      </div>
      {data && <p className="mb-4 text-center text-xs text-muted">{short(data.range.from)} – {short(data.range.to)}</p>}

      {loading && <p className="py-10 text-center text-muted">{t.loading}</p>}
      {error && <p className="py-10 text-center text-muted">{error} <button onClick={reload} className="text-accent">{t.retry}</button></p>}
      {data && !data.hasData && <p className="py-16 text-center text-muted">{t.noStats}</p>}

      {data?.hasData && (
        <div className={clsx('space-y-4', refreshing && 'opacity-60 transition-opacity')}>
          <section className="rounded-xl2 bg-surface p-5">
            <p className="text-sm text-muted">{t.completionRate}</p>
            <p className="text-5xl font-extrabold text-accent">{data.overview.rate === null ? '–' : `${data.overview.rate}%`}</p>
            <p className="mt-1 text-sm text-muted">{data.overview.completed} / {data.overview.completed + data.overview.missed} · {t.skipped}: {data.overview.skipped}</p>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Stat label={t.currentStreak} value={data.overview.currentStreak} flame />
            <Stat label={t.bestStreak} value={data.overview.bestStreak} />
          </div>

          <section className="rounded-xl2 bg-surface p-4">
            <h2 className="mb-3 font-semibold">{t.dailyChart}</h2>
            <div className="h-52" role="img" aria-label={t.dailyChart}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily.map((d) => ({ ...d, label: short(d.date) }))} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f08a31" stopOpacity={0.45} /><stop offset="100%" stopColor="#f08a31" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#2f2f33" vertical={false} />
                  <XAxis dataKey="label" stroke="#8e8e93" fontSize={11} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis stroke="#8e8e93" fontSize={11} domain={[0, 100]} ticks={[0, 50, 100]} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#2a2a2d', border: 'none', borderRadius: 12 }} formatter={(v) => [v === null || v === undefined ? t.noData : `${v}%`, '']} separator="" />
                  <Area type="monotone" dataKey="percent" stroke="#f08a31" strokeWidth={2.5} fill="url(#g)" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {all.data?.hasData && (
            <section className="rounded-xl2 bg-surface p-4">
              <h2 className="mb-3 font-semibold">{t.achievements} <span className="text-sm font-medium text-muted">{BADGES.filter((b) => b.test(all.data!)).length}/{BADGES.length}</span></h2>
              <ul className="grid grid-cols-3 gap-2">
                {BADGES.map((b) => {
                  const ok = b.test(all.data!);
                  return (
                    <li key={b.id} className={clsx('relative rounded-2xl p-3 text-center', ok ? 'bg-accent-soft' : 'bg-raised/60')} title={b.hint}>
                      <p className={clsx('text-3xl', !ok && 'opacity-25 grayscale')} aria-hidden>{b.emoji}</p>
                      <p className={clsx('mt-1 text-[11px] font-semibold leading-tight', ok ? 'text-accent' : 'text-muted')}>{b.title}</p>
                      <p className="mt-0.5 text-[10px] leading-tight text-muted">{b.hint}</p>
                      {!ok && <Lock size={12} className="absolute right-2 top-2 text-muted/60" aria-label={t.locked} />}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {all.data?.hasData && (
            <section className="rounded-xl2 bg-surface p-4">
              <h2 className="mb-2 font-semibold">{t.insights}</h2>
              {insight ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-ok/10 p-3"><p className="text-xs text-muted">{t.bestWeekday}</p><p className="mt-1 font-bold text-ok">{t.weekdayLong[insight.best.w]}</p><p className="text-sm text-muted">{insight.best.avg}%</p></div>
                  <div className="rounded-2xl bg-bad/10 p-3"><p className="text-xs text-muted">{t.weakWeekday}</p><p className="mt-1 font-bold text-bad">{t.weekdayLong[insight.worst.w]}</p><p className="text-sm text-muted">{insight.worst.avg}%</p></div>
                </div>
              ) : <p className="text-sm text-muted">{t.needMoreData}</p>}
            </section>
          )}

          <section>
            <h2 className="mb-2 px-1 font-semibold">{t.byHabit}</h2>
            <ul className="space-y-2">
              {data.habits.map((h) => (
                <li key={h.habitId} className="rounded-2xl bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-semibold">{h.icon && <span className="mr-1.5">{h.icon}</span>}{h.name}{h.archived && <span className="ml-2 text-xs text-muted">{t.archive}</span>}</p>
                    <p className="font-bold text-accent">{h.rate === null ? '–' : `${h.rate}%`}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent" style={{ width: `${h.rate ?? 0}%` }} /></div>
                  <p className="mt-2 text-xs text-muted">
                    {t.scheduledTotal}: {h.scheduled} · {t.completed}: {h.completed} · {t.skipped}: {h.skipped} · {t.missed}: {h.missed}
                  </p>
                  <p className="text-xs text-muted">{t.currentStreak}: {h.currentStreak} · {t.bestStreak}: {h.bestStreak}</p>
                  {h.series.length > 1 && (
                    <div className="mt-2 flex h-8 items-end gap-1" aria-hidden>
                      {h.series.map((s) => <span key={s.from} className="flex-1 rounded-sm bg-accent/70" style={{ height: `${Math.max(s.percent ?? 0, 4)}%`, opacity: s.percent === null ? 0.2 : 1 }} />)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, flame }: { label: string; value: number; flame?: boolean }) {
  return (
    <div className="rounded-xl2 bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-3xl font-extrabold">{flame && <Flame size={24} className="text-accent" />}{value}<span className="text-sm font-medium text-muted">{t.days}</span></p>
    </div>
  );
}
