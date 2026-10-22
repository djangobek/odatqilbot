import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { users, type User } from '../db/schema';
import type { TelegramUser } from '../lib/telegram';
import { isValidTimezone } from '../lib/dates';

export async function upsertTelegramUser(db: Db, tg: TelegramUser, timezone?: string, now = Date.now()): Promise<User> {
  const displayName = [tg.first_name, tg.last_name].filter(Boolean).join(' ') || 'Foydalanuvchi';
  const tz = timezone && isValidTimezone(timezone) ? timezone : undefined;
  // Atomic upsert on the unique telegram_id index: concurrent first requests cannot create duplicates.
  const [row] = await db.insert(users).values({
    telegramId: tg.id, displayName, username: tg.username ?? null,
    language: 'uz', timezone: tz ?? 'Asia/Tashkent', createdAt: now, updatedAt: now,
  }).onConflictDoUpdate({
    target: users.telegramId,
    set: { displayName, username: tg.username ?? null, ...(tz ? { timezone: tz } : {}), updatedAt: now },
  }).returning();
  return row;
}

export async function authenticateUser(db: Db, userId: number): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  return row;
}

export async function setTimezone(db: Db, userId: number, timezone: string, now = Date.now()): Promise<boolean> {
  if (!isValidTimezone(timezone)) return false;
  await db.update(users).set({ timezone, updatedAt: now }).where(eq(users.id, userId));
  return true;
}

export async function setReminders(db: Db, userId: number, enabled: boolean, now = Date.now()): Promise<void> {
  await db.update(users).set({ remindersEnabled: enabled, updatedAt: now }).where(eq(users.id, userId));
}
