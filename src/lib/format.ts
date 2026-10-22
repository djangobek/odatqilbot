import { addDays, parseDate, weekday } from './dates';
import { t } from './i18n';

export function longDate(date: string): string {
  const d = parseDate(date);
  return `${d.getUTCDate()}-${t.months[d.getUTCMonth()].toLowerCase()}, ${t.weekdayLong[weekday(date)].toLowerCase()}`;
}
export function dayTitle(date: string, today: string): string {
  if (date === today) return t.today;
  if (date === addDays(today, -1)) return t.yesterday;
  if (date === addDays(today, 1)) return t.tomorrow;
  return longDate(date);
}
export function monthTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${t.months[m - 1]} ${y}`;
}
export function timeOf(ms: number, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(ms));
}
/** Monday-first order of JS weekday numbers (0 = Sunday). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function scheduleLabel(mask: number): string {
  if (mask === 127) return t.everyDay;
  if (mask === 0b0111110) return t.workdays;
  return WEEK_ORDER.filter((d) => (mask >> d) & 1).map((d) => t.weekdayShort[d]).join(', ');
}
