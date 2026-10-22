import { min } from 'drizzle-orm';
import type { Db } from '../db';
import { habits } from '../db/schema';
import { eq } from 'drizzle-orm';
import { addDays, monthRange, parseDate, fmtDate } from '../lib/dates';
import { buildDays, computeStats, summarizeDay, type DaySummary, type StatsResult } from '../lib/stats';
import { loadHabitDefs } from './habits';
import { getNote, loadRecords, type NoteDto } from './records';

export type DayResponse = { day: DaySummary; note: NoteDto; totalHabits: number; activeHabits: number };

export async function getDay(db: Db, userId: number, date: string, today: string): Promise<DayResponse> {
  const [defs, recs, note] = await Promise.all([loadHabitDefs(db, userId), loadRecords(db, userId, date, date), getNote(db, userId, date)]);
  return {
    day: summarizeDay(date, today, defs, recs, true),
    note,
    totalHabits: defs.length,
    activeHabits: defs.filter((h) => !h.archived).length,
  };
}

export async function getMonth(db: Db, userId: number, month: string, today: string): Promise<{ month: string; days: DaySummary[] }> {
  const { from, to } = monthRange(month);
  const [defs, recs] = await Promise.all([loadHabitDefs(db, userId), loadRecords(db, userId, from, to)]);
  return { month, days: buildDays(from, to, today, defs, recs, false) };
}

export type RangeKey = '7d' | '30d' | 'month' | 'all';

export async function getStats(db: Db, userId: number, range: RangeKey, today: string): Promise<StatsResult & { hasData: boolean }> {
  const defs = await loadHabitDefs(db, userId);
  const [first] = await db.select({ v: min(habits.startDate) }).from(habits).where(eq(habits.userId, userId));
  const earliest = first?.v ?? today;
  let from: string;
  if (range === '7d') from = addDays(today, -6);
  else if (range === '30d') from = addDays(today, -29);
  else if (range === 'month') from = fmtDate(new Date(Date.UTC(parseDate(today).getUTCFullYear(), parseDate(today).getUTCMonth(), 1)));
  else from = earliest;
  if (from < earliest) from = earliest;
  if (from > today) from = today;
  const recs = await loadRecords(db, userId, earliest, today);
  return { ...computeStats({ from, to: today, today, habits: defs, recs, earliest }), hasData: defs.length > 0 };
}
