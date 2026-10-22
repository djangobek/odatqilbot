import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { users } from '@/db/schema';
import { createHabitSchema } from '@/lib/validation';
import { createHabit } from '@/server/habits';
import { setRecord } from '@/server/records';
import { claimDelivery, findDueReminders, releaseDelivery } from '@/server/reminders';
import { setReminders, setTimezone } from '@/server/users';
import { freshDb, makeUser } from './helpers';

const TODAY = '2026-10-22'; // Thursday; Asia/Tashkent is UTC+5
let db: Db;
let uid: number;
const at = (hhmmUtc: string) => new Date(`2026-10-22T${hhmmUtc}:00Z`);

beforeEach(async () => {
  db = (await freshDb()).db;
  uid = (await makeUser(db, 1)).id;
  await createHabit(db, uid, createHabitSchema.parse({ name: 'Read', weekdays: 127, startDate: '2026-10-20', reminderTime: '08:00' }), TODAY);
});

describe('reminder scheduling', () => {
  it('fires at the user-local time and within the catch-up window only', async () => {
    expect(await findDueReminders(db, at('02:59'))).toHaveLength(0); // 07:59 local
    expect(await findDueReminders(db, at('03:00'))).toHaveLength(1); // 08:00 local
    expect(await findDueReminders(db, at('03:09'))).toHaveLength(1); // catch-up after a restart
    expect(await findDueReminders(db, at('03:30'))).toHaveLength(0); // too late
  });
  it('respects timezone changes', async () => {
    await setTimezone(db, uid, 'Europe/London'); // UTC+1 in October (BST ended Oct 25 2026)
    expect(await findDueReminders(db, at('03:00'))).toHaveLength(0);
    expect(await findDueReminders(db, at('07:00'))).toHaveLength(1);
    expect(await setTimezone(db, uid, 'Not/AZone')).toBe(false);
  });
  it('delivers once per day and can be released for retry', async () => {
    const [r] = await findDueReminders(db, at('03:01'));
    expect(await claimDelivery(db, r)).toBe(true);
    expect(await claimDelivery(db, r)).toBe(false);
    expect(await findDueReminders(db, at('03:02'))).toHaveLength(0);
    await releaseDelivery(db, r);
    expect(await findDueReminders(db, at('03:02'))).toHaveLength(1);
  });
  it('only one of several concurrent scanners wins the delivery slot', async () => {
    const [r] = await findDueReminders(db, at('03:01'));
    const results = await Promise.all(Array.from({ length: 6 }, () => claimDelivery(db, r)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it('skips completed habits and users with reminders off', async () => {
    const [r] = await findDueReminders(db, at('03:01'));
    await setRecord(db, uid, { habitId: r.habitId, date: TODAY, status: 'COMPLETED' }, TODAY);
    expect(await findDueReminders(db, at('03:01'))).toHaveLength(0);
    await setRecord(db, uid, { habitId: r.habitId, date: TODAY, status: 'PENDING' }, TODAY);
    expect(await findDueReminders(db, at('03:01'))).toHaveLength(1);
    await setReminders(db, uid, false);
    expect((await db.select().from(users).where(eq(users.id, uid)))[0]?.remindersEnabled).toBe(false);
    expect(await findDueReminders(db, at('03:01'))).toHaveLength(0);
  });
  it('skips unscheduled weekdays', async () => {
    db = (await freshDb()).db;
    uid = (await makeUser(db, 2)).id;
    await createHabit(db, uid, createHabitSchema.parse({ name: 'Mon only', weekdays: 0b0000010, startDate: '2026-10-01', reminderTime: '08:00' }), TODAY);
    expect(await findDueReminders(db, at('03:01'))).toHaveLength(0); // Thursday
  });
});
