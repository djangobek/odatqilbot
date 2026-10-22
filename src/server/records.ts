import { and, eq, gte, lte } from 'drizzle-orm';
import type { Db } from '../db';
import { dailyNotes, habitRecords } from '../db/schema';
import { isScheduled } from '../lib/schedule';
import { recKey, type RecordMap, type RecordStatus } from '../lib/stats';
import { HttpError } from './errors';
import { getOwnedHabit, loadHabit } from './habits';

export async function setRecord(
  db: Db, userId: number,
  input: { habitId: number; date: string; status: RecordStatus; note?: string | null },
  today: string, now = Date.now(),
) {
  if (input.date > today) throw new HttpError(400, 'Kelajakdagi kunni belgilab bo‘lmaydi');
  await getOwnedHabit(db, userId, input.habitId); // ownership check
  const [existing] = await db.select().from(habitRecords)
    .where(and(eq(habitRecords.habitId, input.habitId), eq(habitRecords.date, input.date)));
  if (!existing && !isScheduled(await loadHabit(db, userId, input.habitId), input.date)) {
    throw new HttpError(400, 'Bu odat tanlangan kunga rejalashtirilmagan');
  }
  const completedAt = input.status === 'COMPLETED' ? (existing?.status === 'COMPLETED' ? existing.completedAt ?? now : now) : null;
  const note = input.note === undefined ? existing?.note ?? null : input.note;
  // Atomic upsert on the (habit_id, date) unique index: no duplicates, one row per day.
  const [row] = await db.insert(habitRecords).values({
    userId, habitId: input.habitId, date: input.date, status: input.status, completedAt, note, createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: [habitRecords.habitId, habitRecords.date],
    set: { status: input.status, completedAt, note, updatedAt: now },
  }).returning();
  return row;
}

export async function loadRecords(db: Db, userId: number, from: string, to: string): Promise<RecordMap> {
  const rows = await db.select().from(habitRecords)
    .where(and(eq(habitRecords.userId, userId), gte(habitRecords.date, from), lte(habitRecords.date, to)));
  const map: RecordMap = new Map();
  for (const r of rows) map.set(recKey(r.habitId, r.date), { status: r.status, completedAt: r.completedAt, note: r.note });
  return map;
}

export type NoteDto = { date: string; wentWell: string; difficult: string; notes: string };

export async function getNote(db: Db, userId: number, date: string): Promise<NoteDto> {
  const [n] = await db.select().from(dailyNotes).where(and(eq(dailyNotes.userId, userId), eq(dailyNotes.date, date)));
  return { date, wentWell: n?.wentWell ?? '', difficult: n?.difficult ?? '', notes: n?.notes ?? '' };
}

export async function saveNote(db: Db, userId: number, input: NoteDto, now = Date.now()): Promise<NoteDto> {
  const clean = { wentWell: input.wentWell.trim(), difficult: input.difficult.trim(), notes: input.notes.trim() };
  if (!clean.wentWell && !clean.difficult && !clean.notes) {
    await db.delete(dailyNotes).where(and(eq(dailyNotes.userId, userId), eq(dailyNotes.date, input.date)));
    return { date: input.date, ...clean };
  }
  await db.insert(dailyNotes).values({ userId, date: input.date, ...clean, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: [dailyNotes.userId, dailyNotes.date], set: { ...clean, updatedAt: now } });
  return { date: input.date, ...clean };
}
