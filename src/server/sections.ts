import { and, count as count_, eq, max } from 'drizzle-orm';
import type { Db } from '../db';
import { sections, type SectionRow } from '../db/schema';
import { HttpError } from './errors';

export const MAX_SECTIONS_PER_USER = 20;

export type SectionDto = { id: number; name: string; position: number };
const dto = (r: SectionRow): SectionDto => ({ id: r.id, name: r.name, position: r.position });

export async function listSections(db: Db, userId: number): Promise<SectionDto[]> {
  const rows = await db.select().from(sections).where(eq(sections.userId, userId));
  return rows.sort((a, b) => a.position - b.position || a.id - b.id).map(dto);
}

async function assertUniqueName(db: Db, userId: number, name: string, exceptId?: number) {
  const rows = await db.select({ id: sections.id, name: sections.name }).from(sections).where(eq(sections.userId, userId));
  if (rows.some((r) => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(400, 'Bunday nomli bo‘lim allaqachon bor');
  }
}

export async function createSection(db: Db, userId: number, name: string, now = Date.now()): Promise<SectionDto> {
  const [{ n }] = await db.select({ n: count_() }).from(sections).where(eq(sections.userId, userId));
  if (n >= MAX_SECTIONS_PER_USER) throw new HttpError(400, `Bo‘limlar soni ${MAX_SECTIONS_PER_USER} tadan oshmasligi kerak`);
  await assertUniqueName(db, userId, name);
  const [last] = await db.select({ v: max(sections.position) }).from(sections).where(eq(sections.userId, userId));
  const [row] = await db.insert(sections).values({ userId, name, position: (last?.v ?? -1) + 1, createdAt: now, updatedAt: now }).returning();
  return dto(row);
}

async function owned(db: Db, userId: number, id: number): Promise<SectionRow> {
  const [row] = await db.select().from(sections).where(and(eq(sections.id, id), eq(sections.userId, userId)));
  if (!row) throw new HttpError(404, 'Bo‘lim topilmadi');
  return row;
}

export async function renameSection(db: Db, userId: number, id: number, name: string, now = Date.now()): Promise<SectionDto> {
  await owned(db, userId, id);
  await assertUniqueName(db, userId, name, id);
  const [row] = await db.update(sections).set({ name, updatedAt: now }).where(eq(sections.id, id)).returning();
  return dto(row);
}

/** Habits of a deleted section are kept (their section becomes empty); only the group disappears. */
export async function deleteSection(db: Db, userId: number, id: number): Promise<void> {
  await owned(db, userId, id);
  await db.delete(sections).where(and(eq(sections.id, id), eq(sections.userId, userId)));
}
