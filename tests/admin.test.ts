import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { habits, users, type User } from '@/db/schema';
import { adminTelegramIds } from '@/lib/env';
import { createHabitSchema } from '@/lib/validation';
import { deleteUser, getSettings, listAudit, listUsers, overview, setBan, setRole, setSettings } from '@/server/admin';
import { audienceCounts, cancelBroadcast, claimNext, createBroadcast, finishBroadcast, listBroadcasts, markRecipient, nextBatch, refreshCounts, renderBroadcast } from '@/server/broadcasts';
import { createHabit } from '@/server/habits';
import { upsertTelegramUser } from '@/server/users';
import { freshDb, makeUser } from './helpers';

let db: Db;
let admin: User;
let alice: User;
let bob: User;
const NOW = 1_800_000_000_000;

async function asAdmin(u: User): Promise<User> {
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, u.id));
  return { ...u, role: 'admin' };
}
const input = (over: Partial<Parameters<typeof createBroadcast>[2]> = {}) => ({ text: 'Salom {name}', audience: 'all', ...over }) as Parameters<typeof createBroadcast>[2];

beforeEach(async () => {
  db = (await freshDb()).db;
  admin = await asAdmin(await makeUser(db, 100));
  alice = await makeUser(db, 101);
  bob = await makeUser(db, 102);
});
afterEach(() => { delete process.env.ADMIN_TELEGRAM_IDS; });

describe('admin role', () => {
  it('parses ADMIN_TELEGRAM_IDS and promotes those users on login', async () => {
    expect(adminTelegramIds({ ADMIN_TELEGRAM_IDS: ' 5, 7;x 0 -3 ' })).toEqual([5, 7]);
    process.env.ADMIN_TELEGRAM_IDS = '555';
    const boss = await upsertTelegramUser(db, { id: 555, first_name: 'Boss' });
    const other = await upsertTelegramUser(db, { id: 556, first_name: 'Other' });
    expect(boss.role).toBe('admin');
    expect(other.role).toBe('user');
  });

  it('promotes/demotes, but never yourself or an env super admin', async () => {
    await setRole(db, admin, alice.id, 'admin', NOW);
    expect((await listUsers(db, { filter: 'admins' })).users.map((u) => u.id)).toContain(alice.id);
    await setRole(db, admin, alice.id, 'user', NOW);
    await expect(setRole(db, admin, admin.id, 'user')).rejects.toThrow();
    process.env.ADMIN_TELEGRAM_IDS = '102';
    await setRole(db, admin, bob.id, 'admin');
    await expect(setRole(db, admin, bob.id, 'user')).rejects.toThrow(/bosh admin/);
  });
});

describe('moderation', () => {
  it('bans and unbans, refusing self and admins', async () => {
    await setBan(db, admin, alice.id, true, 'spam', NOW);
    let [row] = await db.select().from(users).where(eq(users.id, alice.id));
    expect(row).toMatchObject({ banned: true, banReason: 'spam' });
    await setBan(db, admin, alice.id, false, null, NOW);
    [row] = await db.select().from(users).where(eq(users.id, alice.id));
    expect(row).toMatchObject({ banned: false, banReason: null });
    await expect(setBan(db, admin, admin.id, true)).rejects.toThrow();
    await expect(setBan(db, admin, 99999, true)).rejects.toThrow(/topilmadi/);
    const other = await asAdmin(await makeUser(db, 103));
    await expect(setBan(db, admin, other.id, true)).rejects.toThrow();
  });

  it('deletes a user with all their data and logs every action', async () => {
    await createHabit(db, alice.id, createHabitSchema.parse({ name: 'Read', weekdays: 127, startDate: '2026-10-20' }), '2026-10-22');
    await deleteUser(db, admin, alice.id, NOW);
    expect(await db.select().from(habits).where(eq(habits.userId, alice.id))).toHaveLength(0);
    await expect(deleteUser(db, admin, admin.id)).rejects.toThrow();
    expect((await listAudit(db))[0]).toMatchObject({ action: 'delete_user', adminName: admin.displayName });
  });
});

describe('user list', () => {
  it('searches by name, username and telegram id and filters', async () => {
    await upsertTelegramUser(db, { id: 200, first_name: 'Zaynab', username: 'zay_n' });
    expect((await listUsers(db, { q: 'zayn' })).users).toHaveLength(1);
    expect((await listUsers(db, { q: '@zay_n' })).users).toHaveLength(1);
    expect((await listUsers(db, { q: '200' })).users).toHaveLength(1);
    expect((await listUsers(db, { q: '%' })).total).toBe(0); // LIKE wildcards are escaped
    await setBan(db, admin, bob.id, true, null, NOW);
    expect((await listUsers(db, { filter: 'banned' })).users.map((u) => u.id)).toEqual([bob.id]);
    expect((await listUsers(db, { filter: 'all' })).total).toBe(4);
  });
});

describe('broadcasts', () => {
  it('targets audiences and skips banned or blocked users', async () => {
    await setBan(db, admin, bob.id, true, null, NOW);
    await db.update(users).set({ botBlocked: true }).where(eq(users.id, alice.id));
    await expect(createBroadcast(db, admin, input({ audience: `user:${bob.id}` }), NOW)).rejects.toThrow(/Qabul qiluvchi/);
    const all = await createBroadcast(db, admin, input(), NOW);
    expect(all.total).toBe(1); // only the admin is reachable
    const me = await createBroadcast(db, admin, input({ audience: 'me' }), NOW);
    expect(me.audience).toBe(`user:${admin.id}`);
    expect(await audienceCounts(db, NOW)).toMatchObject({ all: 1, admins: 1 });
  });

  it('runs the worker flow: claim, batch, progress, finish, resume', async () => {
    const b = await createBroadcast(db, admin, input(), NOW);
    expect(b).toMatchObject({ status: 'queued', total: 3 });
    const claimed = await claimNext(db, NOW);
    expect(claimed?.status).toBe('sending');
    const batch = await nextBatch(db, b.id, 2);
    expect(batch).toHaveLength(2);
    await markRecipient(db, batch[0].rid, 'sent');
    await markRecipient(db, batch[1].rid, 'blocked', '403');
    expect(await refreshCounts(db, b.id)).toBe(1); // one still pending
    expect((await claimNext(db, NOW))?.id).toBe(b.id); // a restarted worker resumes the same broadcast
    const [last] = await nextBatch(db, b.id, 5);
    await markRecipient(db, last.rid, 'failed', 'boom');
    expect(await refreshCounts(db, b.id)).toBe(0);
    await finishBroadcast(db, b.id, NOW + 1);
    expect((await listBroadcasts(db))[0]).toMatchObject({ status: 'done', sent: 1, blocked: 1, failed: 1, finishedAt: NOW + 1 });
    expect(await claimNext(db, NOW)).toBeUndefined();
  });

  it('keeps scheduled broadcasts until due and can cancel them', async () => {
    const b = await createBroadcast(db, admin, input({ scheduledAt: NOW + 3_600_000 }), NOW);
    expect(b.status).toBe('scheduled');
    expect(await claimNext(db, NOW)).toBeUndefined();
    expect((await claimNext(db, NOW + 3_700_000))?.id).toBe(b.id);
    await cancelBroadcast(db, admin, b.id, NOW);
    await expect(cancelBroadcast(db, admin, b.id)).rejects.toThrow(/bekor qilib/);
    expect(await claimNext(db, NOW)).toBeUndefined();
  });

  it('renders safe Telegram HTML with formatting and the {name} placeholder', () => {
    expect(renderBroadcast('Hi {name} <b>x</b> & **bold** __it__', 'Ali Valiyev')).toBe('Hi Ali &lt;b&gt;x&lt;/b&gt; &amp; <b>bold</b> <i>it</i>');
    expect(renderBroadcast('{name}', '  ')).toBe('do‘stim');
  });
});

describe('settings and dashboard', () => {
  it('stores global settings and logs the change', async () => {
    expect((await getSettings(db, NOW)).maintenance).toBe(false);
    const s = await setSettings(db, admin, { maintenance: true, announcement: 'Ish bor' }, NOW);
    expect(s).toMatchObject({ maintenance: true, announcement: 'Ish bor' });
    expect((await listAudit(db))[0].action).toBe('settings');
  });

  it('computes overview counters and a 30-day series', async () => {
    await db.update(users).set({ lastSeenAt: NOW - 1000 }).where(eq(users.id, alice.id));
    await createHabit(db, alice.id, createHabitSchema.parse({ name: 'Read', weekdays: 127, startDate: '2026-10-20' }), '2026-10-22');
    const o = await overview(db, NOW);
    expect(o.users).toMatchObject({ total: 3, dau: 1, admins: 1, banned: 0 });
    expect(o.habits).toMatchObject({ total: 1, active: 1 });
    expect(o.series).toHaveLength(30);
    expect(o.topHabits[0]).toEqual({ name: 'read', count: 1 });
  });
});
