import { and, count as count_, eq, gt, inArray } from 'drizzle-orm';
import type { Db } from '../db';
import { habits, habitSchedules, sections, type HabitRow } from '../db/schema';
import { addDays } from '../lib/dates';
import { ALL_DAYS, maskAt, type HabitDef } from '../lib/schedule';
import type { z } from 'zod';
import type { createHabitSchema, updateHabitSchema } from '../lib/validation';
import { HttpError } from './errors';

export const MAX_HABITS_PER_USER = 100;

const toDef = (r: HabitRow, schedules: { effectiveFrom: string; weekdays: number }[]): HabitDef => ({
  id: r.id, name: r.name, description: r.description, icon: r.icon, category: r.category,
  startDate: r.startDate, endDate: r.endDate, reminderTime: r.reminderTime, archived: r.archived, sectionId: r.sectionId,
  schedules: [...schedules].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
});

export async function loadHabitDefs(db: Db, userId: number): Promise<HabitDef[]> {
  const rows = await db.select().from(habits).where(eq(habits.userId, userId));
  if (rows.length === 0) return [];
  const scheds = await db.select().from(habitSchedules).where(inArray(habitSchedules.habitId, rows.map((r) => r.id)));
  return rows.map((r) => toDef(r, scheds.filter((s) => s.habitId === r.id)));
}

export async function getOwnedHabit(db: Db, userId: number, id: number): Promise<HabitRow> {
  const [row] = await db.select().from(habits).where(and(eq(habits.id, id), eq(habits.userId, userId)));
  if (!row) throw new HttpError(404, 'Odat topilmadi');
  return row;
}

async function upsertVersion(tx: Pick<Db, 'delete' | 'insert'>, habitId: number, effectiveFrom: string, weekdays: number) {
  await tx.delete(habitSchedules).where(and(eq(habitSchedules.habitId, habitId), gt(habitSchedules.effectiveFrom, effectiveFrom)));
  await tx.insert(habitSchedules).values({ habitId, effectiveFrom, weekdays })
    .onConflictDoUpdate({ target: [habitSchedules.habitId, habitSchedules.effectiveFrom], set: { weekdays } });
}

/** A habit may only point at one of the caller's own sections. */
async function assertOwnSection(db: Pick<Db, 'select'>, userId: number, sectionId: number | null | undefined) {
  if (!sectionId) return;
  const [row] = await db.select({ id: sections.id }).from(sections).where(and(eq(sections.id, sectionId), eq(sections.userId, userId)));
  if (!row) throw new HttpError(404, 'Bo‘lim topilmadi');
}

export async function createHabit(db: Db, userId: number, input: z.infer<typeof createHabitSchema>, today: string, now = Date.now()): Promise<HabitDef> {
  const startDate = input.startDate ?? today;
  await assertOwnSection(db, userId, input.sectionId);
  const [{ n: count }] = await db.select({ n: count_() }).from(habits).where(eq(habits.userId, userId));
  if (count >= MAX_HABITS_PER_USER) throw new HttpError(400, `Odatlar soni ${MAX_HABITS_PER_USER} tadan oshmasligi kerak`);
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(habits).values({
      userId, name: input.name, description: input.description ?? null, icon: input.icon ?? null,
      category: input.category ?? null, startDate, endDate: input.endDate ?? null,
      reminderTime: input.reminderTime ?? null, sectionId: input.sectionId ?? null, archived: false, createdAt: now, updatedAt: now,
    }).returning();
    await tx.insert(habitSchedules).values({ habitId: row.id, effectiveFrom: startDate, weekdays: input.weekdays });
    return row.id;
  });
  return loadOne(db, userId, id);
}

async function loadOne(db: Db, userId: number, id: number): Promise<HabitDef> {
  const row = await getOwnedHabit(db, userId, id);
  return toDef(row, await db.select().from(habitSchedules).where(eq(habitSchedules.habitId, id)));
}

export async function updateHabit(db: Db, userId: number, id: number, input: z.infer<typeof updateHabitSchema>, today: string, now = Date.now()): Promise<HabitDef> {
  const row = await getOwnedHabit(db, userId, id);
  await assertOwnSection(db, userId, input.sectionId);
  const nextStart = input.startDate ?? row.startDate;
  const nextEnd = input.endDate !== undefined ? input.endDate : row.endDate;
  if (nextEnd && nextEnd < nextStart) throw new HttpError(400, 'Tugash sanasi boshlanishdan oldin bo‘lmasligi kerak');
  await db.transaction(async (tx) => {
    const patch: Partial<HabitRow> = { updatedAt: now };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description ?? null;
    if (input.icon !== undefined) patch.icon = input.icon ?? null;
    if (input.category !== undefined) patch.category = input.category ?? null;
    if (input.startDate !== undefined) patch.startDate = input.startDate;
    if (input.endDate !== undefined) patch.endDate = input.endDate ?? null;
    if (input.reminderTime !== undefined) patch.reminderTime = input.reminderTime ?? null;
    if (input.sectionId !== undefined) patch.sectionId = input.sectionId ?? null;
    await tx.update(habits).set(patch).where(eq(habits.id, id));

    if (input.weekdays !== undefined && !row.archived) {
      const versions = (await tx.select().from(habitSchedules).where(eq(habitSchedules.habitId, id)))
        .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
      const start = input.startDate ?? row.startDate;
      const effective = start > today ? start : today;
      if (maskAt({ schedules: versions }, effective) !== input.weekdays) await upsertVersion(tx, id, effective, input.weekdays);
    }
  });
  return loadOne(db, userId, id);
}

/** Archive never touches records. Past days keep their schedule; from tomorrow the habit is unscheduled. */
export async function setArchived(db: Db, userId: number, id: number, archived: boolean, today: string, now = Date.now()): Promise<HabitDef> {
  const row = await getOwnedHabit(db, userId, id);
  if (row.archived === archived) return loadOne(db, userId, id);
  await db.transaction(async (tx) => {
    const versions = (await tx.select().from(habitSchedules).where(eq(habitSchedules.habitId, id)))
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    if (archived) {
      await upsertVersion(tx, id, addDays(today, 1), 0);
    } else {
      const lastActive = [...versions].reverse().find((v) => v.weekdays > 0)?.weekdays ?? ALL_DAYS;
      await upsertVersion(tx, id, today, lastActive);
    }
    await tx.update(habits).set({ archived, updatedAt: now }).where(eq(habits.id, id));
  });
  return loadOne(db, userId, id);
}

/** Permanent deletion; cascades to schedules and records. Callers must confirm with the user. */
export async function deleteHabit(db: Db, userId: number, id: number): Promise<void> {
  await getOwnedHabit(db, userId, id);
  await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, userId)));
}

export { loadOne as loadHabit };
