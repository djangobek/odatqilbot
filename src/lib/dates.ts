// All dates are plain 'YYYY-MM-DD' strings in the user's timezone. No time-of-day drift.
const RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function isValidDate(s: string): boolean {
  return RE.test(s) && fmtDate(parseDate(s)) === s;
}
export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDate(d);
}
/** 0 = Sunday ... 6 = Saturday */
export function weekday(s: string): number {
  return parseDate(s).getUTCDay();
}
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
export function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
export function isValidMonth(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}
export function monthRange(ym: string): { from: string; to: string } {
  const from = `${ym}-01`;
  const d = parseDate(from);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { from, to: fmtDate(d) };
}
export function maxDate(a: string, b: string) {
  return a > b ? a : b;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
/** Wall-clock parts of `now` in the given IANA timezone. */
export function localClock(tz: string, now: Date = new Date()): { date: string; minutes: number; time: string; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now);
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  const hh = Number(get('hour')), mm = Number(get('minute'));
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: hh * 60 + mm,
    time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
    weekday: WD[get('weekday')] ?? 0,
  };
}
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
