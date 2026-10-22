import { sql, and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, or, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../db';
import { broadcastRecipients, broadcasts, users, type BroadcastRow, type User } from '../db/schema';
import type { broadcastSchema } from '../lib/validation';
import { audit } from './admin';
import { HttpError } from './errors';

const DAY = 86_400_000;
export type BroadcastInput = z.infer<typeof broadcastSchema>;

const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * Admin text is plain text, never raw HTML (one stray "<" would make Telegram reject every message).
 * Supported: **bold**, __italic__ and the {name} placeholder (recipient's first name).
 */
export function renderBroadcast(text: string, displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] || 'do‘stim';
  return esc(text)
    .replace(/\*\*(.+?)\*\*/gs, '<b>$1</b>')
    .replace(/__(.+?)__/gs, '<i>$1</i>')
    .replaceAll('{name}', esc(first));
}

function audienceCondition(audience: string, now: number): SQL | undefined {
  switch (audience) {
    case 'all': return undefined;
    case 'active': return gte(users.lastSeenAt, now - 7 * DAY);
    case 'inactive': return or(isNull(users.lastSeenAt), lt(users.lastSeenAt, now - 7 * DAY));
    case 'admins': return eq(users.role, 'admin');
    default: {
      const m = /^user:(\d+)$/.exec(audience);
      if (!m) throw new HttpError(400, 'Auditoriya noto‘g‘ri');
      return eq(users.id, Number(m[1]));
    }
  }
}

export async function createBroadcast(db: Db, admin: User, input: BroadcastInput, now = Date.now()): Promise<BroadcastRow> {
  const audience = input.audience === 'me' ? `user:${admin.id}` : input.audience;
  const recipients = await db.select({ id: users.id, telegramId: users.telegramId }).from(users)
    .where(and(eq(users.banned, false), eq(users.botBlocked, false), audienceCondition(audience, now)));
  if (!recipients.length) throw new HttpError(400, 'Qabul qiluvchi topilmadi (foydalanuvchi botni bloklagan bo‘lishi mumkin)');
  const later = input.scheduledAt && input.scheduledAt > now + 30_000 ? input.scheduledAt : null;

  const row = await db.transaction(async (tx) => {
    const [b] = await tx.insert(broadcasts).values({
      text: input.text, audience, buttonLabel: input.buttonLabel ?? null, buttonUrl: input.buttonUrl ?? null,
      status: later ? 'scheduled' : 'queued', total: recipients.length, createdBy: admin.id, scheduledAt: later, createdAt: now,
    }).returning();
    for (let i = 0; i < recipients.length; i += 1000) {
      await tx.insert(broadcastRecipients).values(recipients.slice(i, i + 1000).map((r) => ({ broadcastId: b.id, userId: r.id, telegramId: r.telegramId })));
    }
    return b;
  });
  await audit(db, admin, 'broadcast', `#${row.id}`, `${audience} · ${recipients.length} ta · ${input.text.slice(0, 80)}`, now);
  return row;
}

export const listBroadcasts = (db: Db, limit = 30) => db.select().from(broadcasts).orderBy(desc(broadcasts.id)).limit(limit);

export async function cancelBroadcast(db: Db, admin: User, id: number, now = Date.now()) {
  const [b] = await db.update(broadcasts).set({ status: 'cancelled', finishedAt: now })
    .where(and(eq(broadcasts.id, id), inArray(broadcasts.status, ['scheduled', 'queued', 'sending']))).returning();
  if (!b) throw new HttpError(409, 'Bu xabarni bekor qilib bo‘lmaydi (allaqachon tugagan)');
  await audit(db, admin, 'broadcast_cancel', `#${id}`, undefined, now);
}

/* ---------- worker side (bot process) ---------- */

/** Next broadcast to work on: due scheduled ones become queued; a "sending" one resumes after a restart. */
export async function claimNext(db: Db, now = Date.now()): Promise<BroadcastRow | undefined> {
  await db.update(broadcasts).set({ status: 'queued' }).where(and(eq(broadcasts.status, 'scheduled'), lte(broadcasts.scheduledAt, now)));
  const [b] = await db.select().from(broadcasts).where(inArray(broadcasts.status, ['queued', 'sending'])).orderBy(asc(broadcasts.id)).limit(1);
  if (!b) return undefined;
  if (b.status === 'sending') return b;
  const [started] = await db.update(broadcasts).set({ status: 'sending', startedAt: now }).where(and(eq(broadcasts.id, b.id), eq(broadcasts.status, 'queued'))).returning();
  return started;
}

export function nextBatch(db: Db, broadcastId: number, size: number) {
  return db.select({ rid: broadcastRecipients.id, userId: broadcastRecipients.userId, telegramId: broadcastRecipients.telegramId, name: users.displayName })
    .from(broadcastRecipients).innerJoin(users, eq(users.id, broadcastRecipients.userId))
    .where(and(eq(broadcastRecipients.broadcastId, broadcastId), eq(broadcastRecipients.status, 'pending')))
    .orderBy(asc(broadcastRecipients.id)).limit(size);
}

export async function markRecipient(db: Db, rid: number, status: 'sent' | 'failed' | 'blocked', error?: string, now = Date.now()) {
  await db.update(broadcastRecipients).set({ status, error: error?.slice(0, 300) ?? null, sentAt: now }).where(eq(broadcastRecipients.id, rid));
}

/** Recomputes the progress counters from the recipient rows; returns how many are still pending. */
export async function refreshCounts(db: Db, broadcastId: number): Promise<number> {
  const rows = await db.select({ status: broadcastRecipients.status, n: count() }).from(broadcastRecipients)
    .where(eq(broadcastRecipients.broadcastId, broadcastId)).groupBy(broadcastRecipients.status);
  const m: Record<string, number> = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  await db.update(broadcasts).set({ sent: m.sent ?? 0, failed: m.failed ?? 0, blocked: m.blocked ?? 0 }).where(eq(broadcasts.id, broadcastId));
  return m.pending ?? 0;
}

export async function finishBroadcast(db: Db, broadcastId: number, now = Date.now()) {
  await db.update(broadcasts).set({ status: 'done', finishedAt: now }).where(and(eq(broadcasts.id, broadcastId), eq(broadcasts.status, 'sending')));
}

export async function broadcastStatus(db: Db, id: number): Promise<BroadcastRow['status'] | undefined> {
  const [b] = await db.select({ status: broadcasts.status }).from(broadcasts).where(eq(broadcasts.id, id));
  return b?.status;
}

export async function markUserBlocked(db: Db, userId: number, now = Date.now()) {
  await db.update(users).set({ botBlocked: true, updatedAt: now }).where(eq(users.id, userId));
}

/** How many people each audience would reach right now (banned users and users who blocked the bot are excluded). */
export async function audienceCounts(db: Db, now = Date.now()) {
  const [r] = await db.select({
    all: count(),
    active: sql<number>`count(*) filter (where ${users.lastSeenAt} >= ${now - 7 * DAY})`.mapWith(Number),
    inactive: sql<number>`count(*) filter (where ${users.lastSeenAt} is null or ${users.lastSeenAt} < ${now - 7 * DAY})`.mapWith(Number),
    admins: sql<number>`count(*) filter (where ${users.role} = 'admin')`.mapWith(Number),
  }).from(users).where(and(eq(users.banned, false), eq(users.botBlocked, false)));
  return r;
}
