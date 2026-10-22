import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import type { Db } from '../db';
import { habitRecords, habitSchedules, habits, reminderDeliveries, users } from '../db/schema';
import { addDays, localClock, timeToMinutes } from '../lib/dates';
import { isScheduled, type HabitDef } from '../lib/schedule';

export type DueReminder = {
  userId: number;
  telegramId: number;
  habitId: number;
  name: string;
  description: string | null;
  icon: string | null;
  date: string;
  reminderTime: string;
};

/** A reminder is still sent if the scheduler was down for up to this many minutes. */
export const CATCH_UP_MINUTES = 10;

/**
 * Finds reminders that should be sent right now.
 * Rules: user has reminders enabled, habit is active and scheduled for the user's local date,
 * the local time is within [reminderTime, reminderTime + CATCH_UP_MINUTES], the habit is not
 * already completed/skipped, and it was not delivered yet.
 */
export async function findDueReminders(db: Db, now = new Date(), catchUp = CATCH_UP_MINUTES): Promise<DueReminder[]> {
  const rows = await db
    .select({
      userId: users.id, telegramId: users.telegramId, timezone: users.timezone,
      habit: habits,
    })
    .from(habits)
    .innerJoin(users, eq(users.id, habits.userId))
    .where(and(eq(users.remindersEnabled, true), eq(habits.archived, false), isNotNull(habits.reminderTime)));

  const timeMatched: { row: (typeof rows)[number]; date: string; weekday: number }[] = [];
  for (const row of rows) {
    const rt = row.habit.reminderTime!;
    let clock;
    try { clock = localClock(row.timezone, now); } catch { continue; }
    const diff = clock.minutes - timeToMinutes(rt);
    if (diff < 0 || diff > catchUp) continue;
    const h = row.habit;
    if (clock.date < h.startDate || (h.endDate && clock.date > h.endDate)) continue;
    timeMatched.push({ row, date: clock.date, weekday: clock.weekday });
  }
  if (timeMatched.length === 0) return [];

  const ids = [...new Set(timeMatched.map((x) => x.row.habit.id))];
  const [schedules, records, delivered] = await Promise.all([
    db.select().from(habitSchedules).where(inArray(habitSchedules.habitId, ids)),
    db.select({ habitId: habitRecords.habitId, date: habitRecords.date, status: habitRecords.status })
      .from(habitRecords).where(inArray(habitRecords.habitId, ids)),
    db.select({ habitId: reminderDeliveries.habitId, date: reminderDeliveries.date, time: reminderDeliveries.reminderTime })
      .from(reminderDeliveries).where(inArray(reminderDeliveries.habitId, ids)),
  ]);

  const out: DueReminder[] = [];
  for (const { row, date } of timeMatched) {
    const h = row.habit;
    const def: HabitDef = {
      id: h.id, name: h.name, description: h.description, icon: h.icon, category: h.category,
      startDate: h.startDate, endDate: h.endDate, reminderTime: h.reminderTime, archived: h.archived, sectionId: h.sectionId,
      schedules: schedules.filter((s) => s.habitId === h.id).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
    };
    if (!isScheduled(def, date)) continue;
    const rec = records.find((r) => r.habitId === h.id && r.date === date);
    if (rec && rec.status !== 'PENDING') continue;
    if (delivered.some((d) => d.habitId === h.id && d.date === date && d.time === h.reminderTime)) continue;
    out.push({
      userId: row.userId, telegramId: row.telegramId, habitId: h.id, name: h.name,
      description: h.description, icon: h.icon, date, reminderTime: h.reminderTime!,
    });
  }
  return out;
}

/** Atomically reserves a delivery slot. Returns false if another scan already took it. */
export async function claimDelivery(db: Db, r: DueReminder, now = Date.now()): Promise<boolean> {
  const claimed = await db.insert(reminderDeliveries)
    .values({ userId: r.userId, habitId: r.habitId, date: r.date, reminderTime: r.reminderTime, sentAt: now })
    .onConflictDoNothing().returning({ id: reminderDeliveries.id });
  return claimed.length > 0;
}

/** Gives the slot back after a transient send failure so the next scan can retry. */
export async function releaseDelivery(db: Db, r: DueReminder): Promise<void> {
  await db.delete(reminderDeliveries).where(and(
    eq(reminderDeliveries.habitId, r.habitId), eq(reminderDeliveries.date, r.date), eq(reminderDeliveries.reminderTime, r.reminderTime),
  ));
}

export async function pruneDeliveries(db: Db, today: string, keepDays = 90): Promise<void> {
  await db.delete(reminderDeliveries).where(lt(reminderDeliveries.date, addDays(today, -keepDays)));
}
