import { beforeEach, describe, expect, it } from 'vitest';
import { createHabit, deleteHabit, loadHabitDefs, setArchived, updateHabit } from '@/server/habits';
import { getDay, getMonth, getStats } from '@/server/queries';
import { saveNote, setRecord } from '@/server/records';
import { upsertTelegramUser } from '@/server/users';
import { createHabitSchema } from '@/lib/validation';
import type { Db } from '@/db';
import { freshDb, makeUser } from './helpers';

const TODAY = '2026-10-22';
let db: Db;
let uid: number;
let other: number;
const mk = (name = 'Read for 30 minutes', weekdays = 127, startDate = '2026-10-20') =>
  createHabit(db, uid, createHabitSchema.parse({ name, weekdays, startDate }), TODAY);

beforeEach(async () => {
  db = (await freshDb()).db;
  uid = (await makeUser(db, 1)).id;
  other = (await makeUser(db, 2)).id;
});

describe('users', () => {
  it('upserts by telegram id (no duplicates) and stores ids above 32 bits', async () => {
    const big = 7_000_000_000; // Telegram ids can exceed 2^31
    const a = await upsertTelegramUser(db, { id: big, first_name: 'Big', username: 'big' }, 'Asia/Samarkand');
    const b = await upsertTelegramUser(db, { id: big, first_name: 'Bigger' }, 'Not/AZone', 1_900_000_000_000);
    expect(b.id).toBe(a.id);
    expect(b).toMatchObject({ telegramId: big, displayName: 'Bigger', username: null, timezone: 'Asia/Samarkand', createdAt: a.createdAt, updatedAt: 1_900_000_000_000 });
    expect(b.remindersEnabled).toBe(true);
  });
  it('concurrent first logins create exactly one user', async () => {
    const rows = await Promise.all(Array.from({ length: 8 }, () => upsertTelegramUser(db, { id: 555, first_name: 'Race' })));
    expect(new Set(rows.map((r) => r.id)).size).toBe(1);
  });
});

describe('habit management', () => {
  it('creates, edits and rejects invalid input', async () => {
    const h = await mk();
    expect((await updateHabit(db, uid, h.id, { name: 'Read more' }, TODAY)).name).toBe('Read more');
    expect(createHabitSchema.safeParse({ name: '', weekdays: 127 }).success).toBe(false);
    expect(createHabitSchema.safeParse({ name: 'x', weekdays: 0 }).success).toBe(false);
    expect(createHabitSchema.safeParse({ name: 'x', weekdays: 127, startDate: '2026-10-10', endDate: '2026-10-01' }).success).toBe(false);
  });
  it('schedule change keeps history', async () => {
    const h = await mk();
    await setRecord(db, uid, { habitId: h.id, date: '2026-10-21', status: 'COMPLETED' }, TODAY);
    await updateHabit(db, uid, h.id, { weekdays: 0b0000010 }, TODAY); // Mondays only from today
    expect((await getDay(db, uid, '2026-10-21', TODAY)).day.items[0].status).toBe('COMPLETED');
    expect((await getDay(db, uid, '2026-10-22', TODAY)).day.scheduled).toBe(0); // Thursday, no longer scheduled
  });
  it('archive keeps history, restore brings it back, deleted habit cascades', async () => {
    const h = await mk();
    await setRecord(db, uid, { habitId: h.id, date: '2026-10-21', status: 'COMPLETED' }, TODAY);
    await setArchived(db, uid, h.id, true, TODAY);
    const past = (await getDay(db, uid, '2026-10-21', TODAY)).day;
    expect(past.items).toHaveLength(1);
    expect(past.items[0]).toMatchObject({ archived: true, status: 'COMPLETED' });
    expect((await getDay(db, uid, '2026-10-23', '2026-10-23')).day.scheduled).toBe(0);
    await setArchived(db, uid, h.id, false, TODAY);
    expect((await getDay(db, uid, TODAY, TODAY)).day.scheduled).toBe(1);
    await deleteHabit(db, uid, h.id);
    expect(await loadHabitDefs(db, uid)).toHaveLength(0);
  });
});

describe('daily tracking', () => {
  it('stores separate daily outcomes and never duplicates', async () => {
    const h = await mk();
    await setRecord(db, uid, { habitId: h.id, date: '2026-10-20', status: 'COMPLETED' }, TODAY);
    await setRecord(db, uid, { habitId: h.id, date: '2026-10-20', status: 'COMPLETED' }, TODAY);
    await setRecord(db, uid, { habitId: h.id, date: '2026-10-22', status: 'COMPLETED' }, TODAY);
    expect((await getDay(db, uid, '2026-10-20', TODAY)).day.items[0].status).toBe('COMPLETED');
    expect((await getDay(db, uid, '2026-10-21', TODAY)).day).toMatchObject({ missed: 1, completed: 0 });
    const m = (await getMonth(db, uid, '2026-10', TODAY)).days;
    expect(m.find((d) => d.date === '2026-10-20')?.state).toBe('complete');
    expect(m.find((d) => d.date === '2026-10-21')?.state).toBe('missed');
    expect(m.find((d) => d.date === '2026-10-05')?.state).toBe('none');
  });
  it('can untick, skip, and rejects the future / unscheduled', async () => {
    const h = await mk();
    await setRecord(db, uid, { habitId: h.id, date: TODAY, status: 'COMPLETED' }, TODAY);
    await setRecord(db, uid, { habitId: h.id, date: TODAY, status: 'PENDING' }, TODAY);
    expect((await getDay(db, uid, TODAY, TODAY)).day.completed).toBe(0);
    await expect(setRecord(db, uid, { habitId: h.id, date: '2026-10-30', status: 'COMPLETED' }, TODAY)).rejects.toThrow();
    await expect(setRecord(db, uid, { habitId: h.id, date: '2026-10-01', status: 'COMPLETED' }, TODAY)).rejects.toThrow(); // before start
  });
  it('keeps completedAt stable on repeat and clears it on untick; epoch-ms survive bigint round trip', async () => {
    const h = await mk();
    const t1 = 1_792_000_000_123;
    const a = await setRecord(db, uid, { habitId: h.id, date: TODAY, status: 'COMPLETED' }, TODAY, t1);
    const b = await setRecord(db, uid, { habitId: h.id, date: TODAY, status: 'COMPLETED', note: 'ok' }, TODAY, t1 + 5000);
    expect(a.completedAt).toBe(t1);
    expect(b).toMatchObject({ completedAt: t1, note: 'ok', createdAt: t1, updatedAt: t1 + 5000 });
    expect((await setRecord(db, uid, { habitId: h.id, date: TODAY, status: 'PENDING' }, TODAY)).completedAt).toBeNull();
  });
  it('isolates users', async () => {
    const h = await mk();
    await expect(setRecord(db, other, { habitId: h.id, date: TODAY, status: 'COMPLETED' }, TODAY)).rejects.toThrow(/topilmadi/);
    await expect(updateHabit(db, other, h.id, { name: 'hack' }, TODAY)).rejects.toThrow();
    await expect(deleteHabit(db, other, h.id)).rejects.toThrow();
    expect(await loadHabitDefs(db, other)).toHaveLength(0);
    expect((await getStats(db, other, 'all', TODAY)).hasData).toBe(false);
  });
  it('stores one note per day and deletes it when emptied', async () => {
    await saveNote(db, uid, { date: TODAY, wentWell: 'a', difficult: '', notes: '' });
    await saveNote(db, uid, { date: TODAY, wentWell: 'b', difficult: '', notes: '' });
    expect((await getDay(db, uid, TODAY, TODAY)).note.wentWell).toBe('b');
    await saveNote(db, uid, { date: TODAY, wentWell: ' ', difficult: '', notes: '' });
    expect((await getDay(db, uid, TODAY, TODAY)).note.wentWell).toBe('');
  });
});

describe('statistics from the database', () => {
  it('matches the calendar', async () => {
    const h = await mk();
    await setRecord(db, uid, { habitId: h.id, date: '2026-10-20', status: 'COMPLETED' }, TODAY);
    await setRecord(db, uid, { habitId: h.id, date: '2026-10-22', status: 'COMPLETED' }, TODAY);
    const s = await getStats(db, uid, 'all', TODAY);
    expect(s.overview).toMatchObject({ scheduled: 3, completed: 2, missed: 1, rate: 67, currentStreak: 1, bestStreak: 1 });
  });
});
