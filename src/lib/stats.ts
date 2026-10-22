import { eachDate, addDays } from './dates';
import { isScheduled, type HabitDef } from './schedule';

/*
 * DEFINITIONS (single source of truth for calendar AND statistics)
 *
 * For a scheduled habit on date D, with `today` in the user's timezone:
 *   COMPLETED                      -> completed
 *   SKIPPED                        -> skipped   (explicit; not a failure, excluded from the rate)
 *   PENDING/no record, D <  today  -> missed
 *   PENDING/no record, D == today  -> pending   (day is not over, never counted as missed)
 *   D > today                      -> upcoming  (never counted)
 *
 * Day completion % = completed / (completed + missed + pending)   [today shows live progress]
 * Period completion rate = completed / (completed + missed)       [today's pending excluded]
 * Unscheduled days are never failures.
 *
 * Streak (day level): a day is a HIT if it has >=1 counted habit and all are completed;
 * a MISS if a past day has a missed habit; everything else (no habits, all skipped,
 * today still open) is NEUTRAL: it neither extends nor breaks the streak.
 * Habit streak uses the same rule on that habit alone.
 */

export type RecordStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED';
export type RecordInfo = { status: RecordStatus; completedAt: number | null; note: string | null };
export type RecordMap = Map<string, RecordInfo>; // key: `${habitId}|${date}`
export const recKey = (habitId: number, date: string) => `${habitId}|${date}`;

export type Outcome = 'completed' | 'skipped' | 'missed' | 'pending' | 'upcoming';

export type DayItem = {
  habitId: number;
  name: string;
  icon: string | null;
  category: string | null;
  description: string | null;
  time: string | null;
  archived: boolean;
  sectionId: number | null;
  status: RecordStatus;
  outcome: Outcome;
  completedAt: number | null;
  note: string | null;
};

export type DayState = 'future' | 'none' | 'complete' | 'partial' | 'missed' | 'open' | 'skipped';

export type DaySummary = {
  date: string;
  scheduled: number;
  completed: number;
  skipped: number;
  missed: number;
  pending: number;
  percent: number | null;
  state: DayState;
  items: DayItem[];
};

export function outcomeOf(status: RecordStatus | undefined, date: string, today: string): Outcome {
  if (date > today) return 'upcoming';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'SKIPPED') return 'skipped';
  return date < today ? 'missed' : 'pending';
}

export function summarizeDay(date: string, today: string, habits: HabitDef[], recs: RecordMap, withItems = true): DaySummary {
  const items: DayItem[] = [];
  let completed = 0, skipped = 0, missed = 0, pending = 0, scheduled = 0;
  for (const h of habits) {
    if (!isScheduled(h, date)) continue;
    scheduled++;
    const r = recs.get(recKey(h.id, date));
    const outcome = outcomeOf(r?.status, date, today);
    if (outcome === 'completed') completed++;
    else if (outcome === 'skipped') skipped++;
    else if (outcome === 'missed') missed++;
    else if (outcome === 'pending') pending++;
    if (withItems) {
      items.push({
        habitId: h.id, name: h.name, icon: h.icon, category: h.category, description: h.description,
        time: h.reminderTime, archived: h.archived, sectionId: h.sectionId ?? null, status: r?.status ?? 'PENDING', outcome,
        completedAt: r?.completedAt ?? null, note: r?.note ?? null,
      });
    }
  }
  items.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.name.localeCompare(b.name));
  const counted = completed + missed + pending;
  const percent = date > today || counted === 0 ? null : Math.round((completed / counted) * 100);
  let state: DayState;
  if (date > today) state = 'future';
  else if (scheduled === 0) state = 'none';
  else if (counted === 0) state = 'skipped';
  else if (percent === 100) state = 'complete';
  else if (completed > 0) state = 'partial';
  else state = date < today ? 'missed' : 'open';
  return { date, scheduled, completed, skipped, missed, pending, percent, state, items };
}

export function buildDays(from: string, to: string, today: string, habits: HabitDef[], recs: RecordMap, withItems = false): DaySummary[] {
  return eachDate(from, to).map((d) => summarizeDay(d, today, habits, recs, withItems));
}

type Flag = 'hit' | 'miss' | 'neutral';

export function streakOf(flags: Flag[]): { current: number; best: number } {
  let run = 0, best = 0;
  for (const f of flags) {
    if (f === 'hit') { run++; best = Math.max(best, run); }
    else if (f === 'miss') run = 0;
  }
  return { current: run, best };
}

export function dayFlag(d: DaySummary): Flag {
  if (d.missed > 0) return 'miss';
  if (d.percent === 100) return 'hit';
  return 'neutral';
}

export type HabitStats = {
  habitId: number; name: string; icon: string | null; archived: boolean;
  scheduled: number; completed: number; skipped: number; missed: number;
  rate: number | null; currentStreak: number; bestStreak: number;
  series: { from: string; percent: number | null }[]; // weekly buckets inside the range
};

export type StatsResult = {
  range: { from: string; to: string };
  overview: { scheduled: number; completed: number; skipped: number; missed: number; rate: number | null; currentStreak: number; bestStreak: number; activeDays: number };
  daily: { date: string; percent: number | null }[];
  habits: HabitStats[];
};

const rate = (c: number, m: number) => (c + m === 0 ? null : Math.round((c / (c + m)) * 100));

export function computeStats(opts: { from: string; to: string; today: string; habits: HabitDef[]; recs: RecordMap; earliest: string }): StatsResult {
  const { from, today, habits, recs, earliest } = opts;
  const to = opts.to > today ? today : opts.to;

  const all = buildDays(earliest, today, today, habits, recs);
  const { current, best } = streakOf(all.map(dayFlag));

  const days = all.filter((d) => d.date >= from && d.date <= to);
  const sum = (k: 'scheduled' | 'completed' | 'skipped' | 'missed') => days.reduce((a, d) => a + d[k], 0);
  const completed = sum('completed'), missed = sum('missed');

  const habitStats: HabitStats[] = habits.map((h) => {
    const outcomesFor = (a: string, b: string) =>
      eachDate(a, b).filter((d) => isScheduled(h, d)).map((d) => ({ date: d, o: outcomeOf(recs.get(recKey(h.id, d))?.status, d, today) }));
    const inRange = from <= to ? outcomesFor(from, to) : [];
    const hist = outcomesFor(h.startDate < earliest ? earliest : h.startDate, today);
    const c = inRange.filter((x) => x.o === 'completed').length;
    const s = inRange.filter((x) => x.o === 'skipped').length;
    const m = inRange.filter((x) => x.o === 'missed').length;
    const st = streakOf(hist.map((x): Flag => (x.o === 'completed' ? 'hit' : x.o === 'missed' ? 'miss' : 'neutral')));
    const series: HabitStats['series'] = [];
    for (let start = from; start <= to; start = addDays(start, 7)) {
      const end = addDays(start, 6) > to ? to : addDays(start, 6);
      const part = inRange.filter((x) => x.date >= start && x.date <= end);
      series.push({ from: start, percent: rate(part.filter((x) => x.o === 'completed').length, part.filter((x) => x.o === 'missed').length) });
    }
    return {
      habitId: h.id, name: h.name, icon: h.icon, archived: h.archived,
      scheduled: inRange.length, completed: c, skipped: s, missed: m, rate: rate(c, m),
      currentStreak: st.current, bestStreak: st.best, series,
    };
  }).filter((h) => h.scheduled > 0 || !h.archived);

  return {
    range: { from, to },
    overview: {
      scheduled: sum('scheduled'), completed, skipped: sum('skipped'), missed, rate: rate(completed, missed),
      currentStreak: current, bestStreak: best, activeDays: days.filter((d) => d.scheduled > 0).length,
    },
    daily: days.map((d) => ({ date: d.date, percent: d.percent })),
    habits: habitStats,
  };
}
