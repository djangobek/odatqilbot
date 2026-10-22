import { and, eq, lt, or } from 'drizzle-orm';
import type { Db } from '../db';
import { digestDeliveries, users } from '../db/schema';
import { addDays, localClock } from '../lib/dates';

export type DigestKind = 'morning' | 'evening';
export const DIGEST_TIME: Record<DigestKind, number> = { morning: 8 * 60, evening: 21 * 60 }; // local minutes since midnight
export const DIGEST_CATCH_UP_MINUTES = 30; // still sent if the bot was down for a while

export type DueDigest = { userId: number; telegramId: number; kind: DigestKind; date: string };

/** Users whose local clock is inside a digest window and who have not received that digest today. */
export async function findDueDigests(db: Db, now = new Date()): Promise<DueDigest[]> {
  const rows = await db.select({
    id: users.id, telegramId: users.telegramId, timezone: users.timezone, morning: users.morningDigest, evening: users.eveningDigest,
  }).from(users).where(and(eq(users.remindersEnabled, true), or(eq(users.morningDigest, true), eq(users.eveningDigest, true))));

  const out: DueDigest[] = [];
  for (const u of rows) {
    let clock;
    try { clock = localClock(u.timezone, now); } catch { continue; }
    for (const kind of ['morning', 'evening'] as const) {
      if (kind === 'morning' ? !u.morning : !u.evening) continue;
      const diff = clock.minutes - DIGEST_TIME[kind];
      if (diff >= 0 && diff <= DIGEST_CATCH_UP_MINUTES) out.push({ userId: u.id, telegramId: u.telegramId, kind, date: clock.date });
    }
  }
  if (out.length === 0) return out;
  const sent = await db.select({ userId: digestDeliveries.userId, kind: digestDeliveries.kind, date: digestDeliveries.date }).from(digestDeliveries);
  return out.filter((d) => !sent.some((s) => s.userId === d.userId && s.kind === d.kind && s.date === d.date));
}

export async function claimDigest(db: Db, d: DueDigest, now = Date.now()): Promise<boolean> {
  const r = await db.insert(digestDeliveries).values({ userId: d.userId, kind: d.kind, date: d.date, sentAt: now })
    .onConflictDoNothing().returning({ id: digestDeliveries.id });
  return r.length > 0;
}

export async function releaseDigest(db: Db, d: DueDigest): Promise<void> {
  await db.delete(digestDeliveries).where(and(eq(digestDeliveries.userId, d.userId), eq(digestDeliveries.kind, d.kind), eq(digestDeliveries.date, d.date)));
}

export async function pruneDigests(db: Db, today: string, keepDays = 30): Promise<void> {
  await db.delete(digestDeliveries).where(lt(digestDeliveries.date, addDays(today, -keepDays)));
}
