import { createHmac, randomBytes } from 'node:crypto';
import type { Db } from '@/db';
import * as schema from '@/db/schema';
import { upsertTelegramUser } from '@/server/users';

export const BOT = '123456:TEST_TOKEN';

export function signInitData(fields: Record<string, string>, token = BOT): string {
  const check = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

export type TestDb = { db: Db; close: () => Promise<void> };
const open: TestDb[] = [];

/** Closes every database opened through freshDb(); registered in tests/setup.ts. */
export async function closeAllDbs() {
  await Promise.all(open.splice(0).map((d) => d.close().catch(() => {})));
}

/**
 * Fresh, fully migrated, isolated database.
 *  - TEST_DATABASE_URL set  -> a real PostgreSQL server; every call gets its own schema (parallel-safe), dropped on close.
 *  - otherwise              -> PGlite (PostgreSQL compiled to WASM, in-process, nothing to install).
 *  - `dataDir` (PGlite only) -> persist to a directory to test re-opening.
 */
export async function freshDb(opts: { dataDir?: string } = {}): Promise<TestDb> {
  const url = process.env.TEST_DATABASE_URL?.trim();
  let made: TestDb;
  if (url) {
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const name = `t_${randomBytes(6).toString('hex')}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query(`create schema "${name}"`);
    const pool = new Pool({ connectionString: url, max: 4, options: `-c search_path=${name}` });
    const db = drizzle(pool, { schema });
    try {
      await migrate(db, { migrationsFolder: 'drizzle', migrationsSchema: name });
    } catch (e) {
      await pool.end().catch(() => {});
      await admin.query(`drop schema "${name}" cascade`).catch(() => {});
      await admin.end().catch(() => {});
      throw e;
    }
    made = {
      db: db as unknown as Db,
      close: async () => { await pool.end(); await admin.query(`drop schema "${name}" cascade`); await admin.end(); },
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const client = new PGlite(opts.dataDir);
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: 'drizzle' }); // re-running on an existing dataDir must be a no-op
    made = { db: db as unknown as Db, close: () => client.close() };
  }
  open.push(made);
  return made;
}

export function makeUser(db: Db, id: number) {
  return upsertTelegramUser(db, { id, first_name: `U${id}` });
}
