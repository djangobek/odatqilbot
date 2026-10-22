import { weekday } from './dates';

export type ScheduleVersion = { effectiveFrom: string; weekdays: number };

export type HabitDef = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  startDate: string;
  endDate: string | null;
  reminderTime: string | null;
  archived: boolean;
  schedules: ScheduleVersion[]; // sorted by effectiveFrom ascending
};

export const ALL_DAYS = 127;
export const WEEKDAYS_ONLY = 0b0111110; // Mon-Fri

export function maskAt(h: Pick<HabitDef, 'schedules'>, date: string): number {
  const s = h.schedules;
  if (s.length === 0) return 0;
  let mask = s[0].weekdays; // dates before the first version use the first version
  for (const v of s) {
    if (v.effectiveFrom <= date) mask = v.weekdays;
    else break;
  }
  return mask;
}

/** Was this habit scheduled on `date` according to the schedule valid at that time? */
export function isScheduled(h: HabitDef, date: string): boolean {
  if (date < h.startDate) return false;
  if (h.endDate && date > h.endDate) return false;
  return ((maskAt(h, date) >> weekday(date)) & 1) === 1;
}
