import { describe, expect, it } from 'vitest';
import { isScheduled, type HabitDef } from '@/lib/schedule';
import { computeStats, recKey, summarizeDay, type RecordMap } from '@/lib/stats';

const habit = (over: Partial<HabitDef> = {}): HabitDef => ({
  id: 1, name: 'Read', description: null, icon: null, category: null, startDate: '2026-10-18', endDate: null,
  reminderTime: null, archived: false, schedules: [{ effectiveFrom: '2026-10-18', weekdays: 127 }], ...over,
});
const rec = (entries: [number, string, 'COMPLETED' | 'SKIPPED'][]): RecordMap =>
  new Map(entries.map(([id, d, s]) => [recKey(id, d), { status: s, completedAt: 1, note: null }]));
const TODAY = '2026-10-21'; // Wednesday

describe('schedule', () => {
  it('respects start/end and weekdays', () => {
    const h = habit({ schedules: [{ effectiveFrom: '2026-10-18', weekdays: 0b0000010 }], endDate: '2026-11-30' }); // Mondays
    expect(isScheduled(h, '2026-10-19')).toBe(true); // Monday
    expect(isScheduled(h, '2026-10-20')).toBe(false);
    expect(isScheduled(h, '2026-10-12')).toBe(false); // before start
    expect(isScheduled(h, '2026-12-07')).toBe(false); // after end
  });
  it('keeps old schedule for past dates after a change', () => {
    const h = habit({ schedules: [{ effectiveFrom: '2026-10-18', weekdays: 127 }, { effectiveFrom: '2026-10-21', weekdays: 0b0000010 }] });
    expect(isScheduled(h, '2026-10-20')).toBe(true);  // old: every day
    expect(isScheduled(h, '2026-10-22')).toBe(false); // new: Mondays only
  });
});

describe('day summary', () => {
  it('does not count today pending as missed, but past pending as missed', () => {
    const recs = rec([[1, '2026-10-21', 'COMPLETED']]);
    const h = [habit(), habit({ id: 2, name: 'B' })];
    const today = summarizeDay(TODAY, TODAY, h, recs);
    expect(today).toMatchObject({ scheduled: 2, completed: 1, pending: 1, missed: 0, percent: 50 });
    const past = summarizeDay('2026-10-20', TODAY, h, new Map());
    expect(past).toMatchObject({ missed: 2, percent: 0, state: 'missed' });
  });
  it('future days are never missed', () => {
    expect(summarizeDay('2026-10-25', TODAY, [habit()], new Map())).toMatchObject({ missed: 0, state: 'future', percent: null });
  });
});

describe('statistics', () => {
  const recs = rec([[1, '2026-10-18', 'COMPLETED'], [1, '2026-10-20', 'COMPLETED'], [1, '2026-10-19', 'SKIPPED']]);
  const s = computeStats({ from: '2026-10-18', to: '2026-10-25', today: TODAY, habits: [habit()], recs, earliest: '2026-10-18' });
  it('caps range at today and excludes skipped and today-pending from the rate', () => {
    expect(s.range.to).toBe(TODAY);
    expect(s.overview).toMatchObject({ scheduled: 4, completed: 2, skipped: 1, missed: 0, rate: 100 });
  });
  it('streak: skipped and open today are neutral', () => {
    expect(s.overview.currentStreak).toBe(2);
    expect(s.overview.bestStreak).toBe(2);
  });
  it('a missed past day breaks the streak', () => {
    const r = rec([[1, '2026-10-18', 'COMPLETED']]);
    const x = computeStats({ from: '2026-10-18', to: TODAY, today: TODAY, habits: [habit()], recs: r, earliest: '2026-10-18' });
    expect(x.overview).toMatchObject({ completed: 1, missed: 2, currentStreak: 0, bestStreak: 1, rate: 33 });
  });
  it('does not count unscheduled days as failures', () => {
    const h = habit({ schedules: [{ effectiveFrom: '2026-10-18', weekdays: 0b0000010 }] }); // Mondays only
    const x = computeStats({ from: '2026-10-18', to: TODAY, today: TODAY, habits: [h], recs: new Map(), earliest: '2026-10-18' });
    expect(x.overview.scheduled).toBe(1); // only Mon 19
  });
  it('habit stats agree with day summaries', () => {
    expect(s.habits[0]).toMatchObject({ scheduled: 4, completed: 2, skipped: 1 });
  });
});
