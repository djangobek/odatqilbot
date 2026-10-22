import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDatabaseUrl, poolConfig } from '@/db';
import { createHabit, loadHabitDefs } from '@/server/habits';
import { createHabitSchema } from '@/lib/validation';
import { freshDb, makeUser } from './helpers';

describe('configuration', () => {
  it('reads DATABASE_URL and fails loudly when it is missing', () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = ' postgresql://u:p@db:5432/app ';
    expect(getDatabaseUrl()).toBe('postgresql://u:p@db:5432/app');
    delete process.env.DATABASE_URL;
    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL/);
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });
  it('builds pool settings (TLS is opt-in)', () => {
    const url = 'postgresql://u:p@db:5432/app';
    expect(poolConfig(url, {}).ssl).toBeUndefined();
    expect(poolConfig(url, { DATABASE_SSL: 'true' }).ssl).toBe(true);
    expect(poolConfig(url, { DATABASE_SSL: 'no-verify' }).ssl).toEqual({ rejectUnauthorized: false });
    expect(poolConfig(url, { DATABASE_POOL_MAX: '3' }).max).toBe(3);
  });
});

describe('persistence', () => {
  // Reopening a persisted data directory only applies to the in-process PGlite backend.
  it.skipIf(!!process.env.TEST_DATABASE_URL)('migrates a fresh database and keeps data across reopen', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dos-'));
    const dataDir = path.join(dir, 'pg');
    const a = await freshDb({ dataDir });
    const u = await makeUser(a.db, 9);
    await createHabit(a.db, u.id, createHabitSchema.parse({ name: 'Persist', weekdays: 127 }), '2026-10-22');
    await a.close();

    const b = await freshDb({ dataDir }); // re-running migrations must be a no-op
    expect((await loadHabitDefs(b.db, u.id)).map((h) => h.name)).toEqual(['Persist']);
    await b.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
