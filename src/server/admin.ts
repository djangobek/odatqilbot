import { and, count, desc, eq, gte, ilike, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db';
import { appSettings, auditLog, broadcastRecipients, broadcasts, habitRecords, habits, users, type User } from '../db/schema';
import { addDays, todayIn } from '../lib/dates';
import { isSuperAdmin } from '../lib/env';
import { HttpError } from './errors';

const DAY = 86_400_000;

/* ---------- audit ---------- */

export async function audit(db: Db, admin: Pick<User, 'id' | 'displayName'>, action: string, target?: string, detail?: string, now = Date.now()) {
  await db.insert(auditLog).values({ adminId: admin.id, adminName: admin.displayName, action, target: target ?? null, detail: detail?.slice(0, 500) ?? null, createdAt: now });
}

export async function listAudit(db: Db, limit = 100) {
  return db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit);
}

/* ---------- global settings (maintenance, announcement) ---------- */

export type AppSettings = { maintenance: boolean; maintenanceMessage: string; announcement: string };
const DEFAULT_MESSAGE = 'Texnik ishlar olib borilmoqda. Tez orada qaytamiz.';
let cache: { db: Db; at: number; value: AppSettings } | null = null;

/** Cached for a few seconds: this is read on every API request. */
export async function getSettings(db: Db, now = Date.now()): Promise<AppSettings> {
  if (cache && cache.db === db && now - cache.at < 5_000) return cache.value;
  const rows = await db.select().from(appSettings);
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const value: AppSettings = {
    maintenance: m.get('maintenance') === '1',
    maintenanceMessage: m.get('maintenanceMessage') || DEFAULT_MESSAGE,
    announcement: m.get('announcement') ?? '',
  };
  cache = { db, at: now, value };
  return value;
}

export async function setSettings(db: Db, admin: User, patch: Partial<AppSettings>, now = Date.now()): Promise<AppSettings> {
  const entries: [string, string][] = [];
  if (patch.maintenance !== undefined) entries.push(['maintenance', patch.maintenance ? '1' : '0']);
  if (patch.maintenanceMessage !== undefined) entries.push(['maintenanceMessage', patch.maintenanceMessage]);
  if (patch.announcement !== undefined) entries.push(['announcement', patch.announcement]);
  for (const [key, value] of entries) {
    await db.insert(appSettings).values({ key, value, updatedAt: now }).onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: now } });
  }
  cache = null;
  if (entries.length) await audit(db, admin, 'settings', undefined, entries.map(([k, v]) => `${k}=${v}`).join('; '), now);
  return getSettings(db, now);
}

/* ---------- dashboard ---------- */

export async function overview(db: Db, now = Date.now()) {
  const since = (d: number) => now - d * DAY;
  const [u] = await db.select({
    total: count(),
    banned: sql<number>`count(*) filter (where ${users.banned})`.mapWith(Number),
    blocked: sql<number>`count(*) filter (where ${users.botBlocked})`.mapWith(Number),
    admins: sql<number>`count(*) filter (where ${users.role} = 'admin')`.mapWith(Number),
    dau: sql<number>`count(*) filter (where ${users.lastSeenAt} >= ${since(1)})`.mapWith(Number),
    wau: sql<number>`count(*) filter (where ${users.lastSeenAt} >= ${since(7)})`.mapWith(Number),
    mau: sql<number>`count(*) filter (where ${users.lastSeenAt} >= ${since(30)})`.mapWith(Number),
    new24: sql<number>`count(*) filter (where ${users.createdAt} >= ${since(1)})`.mapWith(Number),
    new7: sql<number>`count(*) filter (where ${users.createdAt} >= ${since(7)})`.mapWith(Number),
    reminders: sql<number>`count(*) filter (where ${users.remindersEnabled})`.mapWith(Number),
    morning: sql<number>`count(*) filter (where ${users.morningDigest})`.mapWith(Number),
    evening: sql<number>`count(*) filter (where ${users.eveningDigest})`.mapWith(Number),
  }).from(users);

  const [h] = await db.select({
    total: count(),
    active: sql<number>`count(*) filter (where not ${habits.archived})`.mapWith(Number),
  }).from(habits);
  const [r] = await db.select({ completed: count() }).from(habitRecords).where(eq(habitRecords.status, 'COMPLETED'));

  const from = addDays(todayIn('UTC', new Date(now)), -29);
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const signupRows = await db.select({ createdAt: users.createdAt }).from(users).where(gte(users.createdAt, fromMs));
  const doneRows = await db.select({ date: habitRecords.date, n: count() }).from(habitRecords)
    .where(and(eq(habitRecords.status, 'COMPLETED'), gte(habitRecords.date, from))).groupBy(habitRecords.date);
  const signups = new Map<string, number>();
  for (const s of signupRows) {
    const d = new Date(s.createdAt).toISOString().slice(0, 10);
    signups.set(d, (signups.get(d) ?? 0) + 1);
  }
  const done = new Map(doneRows.map((x) => [x.date, x.n]));
  const series: { date: string; signups: number; completions: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const date = addDays(from, i);
    series.push({ date, signups: signups.get(date) ?? 0, completions: done.get(date) ?? 0 });
  }

  const nameExpr = sql<string>`lower(${habits.name})`;
  const top = await db.select({ name: nameExpr, n: count() }).from(habits).groupBy(nameExpr).orderBy(desc(count())).limit(8);

  return {
    users: u,
    habits: { total: h.total, active: h.active, completions: r.completed },
    series,
    topHabits: top.map((t) => ({ name: t.name, count: t.n })),
  };
}

/* ---------- users ---------- */

export const PAGE_SIZE = 20;
export type UserFilter = 'all' | 'active7' | 'new7' | 'inactive' | 'banned' | 'admins' | 'blocked';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function userWhere(q: string, filter: UserFilter, now: number): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  const term = q.trim();
  if (term) {
    const like = `%${escapeLike(term.replace(/^@/, ''))}%`;
    const byName = or(ilike(users.displayName, like), ilike(users.username, like));
    conds.push(/^\d{1,15}$/.test(term) ? or(byName, eq(users.telegramId, Number(term)), eq(users.id, Number(term))) : byName);
  }
  switch (filter) {
    case 'active7': conds.push(gte(users.lastSeenAt, now - 7 * DAY)); break;
    case 'new7': conds.push(gte(users.createdAt, now - 7 * DAY)); break;
    case 'inactive': conds.push(or(isNull(users.lastSeenAt), lt(users.lastSeenAt, now - 7 * DAY))); break;
    case 'banned': conds.push(eq(users.banned, true)); break;
    case 'admins': conds.push(eq(users.role, 'admin')); break;
    case 'blocked': conds.push(eq(users.botBlocked, true)); break;
  }
  return and(...conds);
}

const userColumns = {
  id: users.id, telegramId: users.telegramId, displayName: users.displayName, username: users.username,
  role: users.role, banned: users.banned, banReason: users.banReason, botBlocked: users.botBlocked,
  timezone: users.timezone, createdAt: users.createdAt, lastSeenAt: users.lastSeenAt,
  habits: sql<number>`(select count(*) from habits h where h.user_id = ${users.id} and h.archived = false)`.mapWith(Number),
  completed: sql<number>`(select count(*) from habit_records r where r.user_id = ${users.id} and r.status = 'COMPLETED')`.mapWith(Number),
};

export async function listUsers(db: Db, opts: { q?: string; filter?: UserFilter; page?: number }, now = Date.now()) {
  const where = userWhere(opts.q ?? '', opts.filter ?? 'all', now);
  const page = Math.max(1, opts.page ?? 1);
  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  const rows = await db.select(userColumns).from(users).where(where).orderBy(desc(users.createdAt), desc(users.id)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE);
  return { users: rows.map((x) => ({ ...x, superAdmin: isSuperAdmin(x.telegramId) })), total, page, pageSize: PAGE_SIZE };
}

export async function userDetail(db: Db, id: number) {
  const [u] = await db.select(userColumns).from(users).where(eq(users.id, id));
  if (!u) throw new HttpError(404, 'Foydalanuvchi topilmadi');
  const list = await db.select({ id: habits.id, name: habits.name, icon: habits.icon, archived: habits.archived, reminderTime: habits.reminderTime })
    .from(habits).where(eq(habits.userId, id)).orderBy(desc(habits.createdAt)).limit(100);
  const [rec] = await db.select({ last: sql<string | null>`max(${habitRecords.date})` }).from(habitRecords)
    .where(and(eq(habitRecords.userId, id), eq(habitRecords.status, 'COMPLETED')));
  return { user: { ...u, superAdmin: isSuperAdmin(u.telegramId) }, habits: list, lastCompletedDate: rec?.last ?? null };
}

async function mustFind(db: Db, id: number): Promise<User> {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) throw new HttpError(404, 'Foydalanuvchi topilmadi');
  return u;
}

export async function setBan(db: Db, admin: User, id: number, banned: boolean, reason?: string | null, now = Date.now()) {
  const u = await mustFind(db, id);
  if (u.id === admin.id) throw new HttpError(400, 'O‘zingizni bloklab bo‘lmaydi');
  if (u.role === 'admin') throw new HttpError(400, 'Adminni bloklash uchun avval adminlikdan oling');
  await db.update(users).set({ banned, banReason: banned ? reason ?? null : null, updatedAt: now }).where(eq(users.id, id));
  await audit(db, admin, banned ? 'ban' : 'unban', `${u.displayName} (#${u.id})`, reason ?? undefined, now);
}

export async function setRole(db: Db, admin: User, id: number, role: 'user' | 'admin', now = Date.now()) {
  const u = await mustFind(db, id);
  if (u.id === admin.id) throw new HttpError(400, 'O‘z rolingizni o‘zgartirib bo‘lmaydi');
  if (role === 'user' && isSuperAdmin(u.telegramId)) throw new HttpError(400, 'Bu bosh admin (ADMIN_TELEGRAM_IDS) — uni faqat serverdan olib tashlash mumkin');
  if (role === 'admin' && u.banned) throw new HttpError(400, 'Bloklangan foydalanuvchini admin qilib bo‘lmaydi');
  await db.update(users).set({ role, updatedAt: now }).where(eq(users.id, id));
  await audit(db, admin, role === 'admin' ? 'promote' : 'demote', `${u.displayName} (#${u.id})`, undefined, now);
}

export async function deleteUser(db: Db, admin: User, id: number, now = Date.now()) {
  const u = await mustFind(db, id);
  if (u.id === admin.id) throw new HttpError(400, 'O‘zingizni o‘chirib bo‘lmaydi');
  if (u.role === 'admin') throw new HttpError(400, 'Adminni o‘chirish uchun avval adminlikdan oling');
  await db.delete(users).where(eq(users.id, id)); // habits, records, notes... cascade
  await audit(db, admin, 'delete_user', `${u.displayName} (#${u.id})`, `telegram ${u.telegramId}`, now);
}

const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralize spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export async function exportUsersCsv(db: Db, admin: User, now = Date.now()): Promise<string> {
  const rows = await db.select(userColumns).from(users).orderBy(users.id);
  const head = ['id', 'telegram_id', 'name', 'username', 'role', 'banned', 'bot_blocked', 'timezone', 'habits', 'completed', 'created_at', 'last_seen_at'];
  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : '');
  const lines = [head.join(',')].concat(rows.map((r) => [r.id, r.telegramId, r.displayName, r.username, r.role, r.banned, r.botBlocked, r.timezone, r.habits, r.completed, iso(r.createdAt), iso(r.lastSeenAt)].map(csvCell).join(',')));
  await audit(db, admin, 'export_users', undefined, `${rows.length} rows`, now);
  return lines.join('\n');
}

/* ---------- system health ---------- */

export async function health(db: Db) {
  const t0 = Date.now();
  await db.execute(sql`select 1`);
  const dbMs = Date.now() - t0;
  const [q] = await db.select({ pending: count() }).from(broadcastRecipients)
    .innerJoin(broadcasts, eq(broadcasts.id, broadcastRecipients.broadcastId))
    .where(and(eq(broadcastRecipients.status, 'pending'), or(eq(broadcasts.status, 'queued'), eq(broadcasts.status, 'sending'))));
  return { dbMs, queuePending: q.pending, uptimeSec: Math.round(process.uptime()), node: process.version };
}
