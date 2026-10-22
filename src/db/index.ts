import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

/**
 * Driver-agnostic database type: works with node-postgres in production and with
 * PGlite (in-process PostgreSQL) in tests; transactions receive the same type.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

export function getDatabaseUrl(): string {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) {
    throw new Error('DATABASE_URL is not set (e.g. postgresql://user:pass@host:5432/dbname). On Railway add a PostgreSQL service and reference ${{Postgres.DATABASE_URL}}.');
  }
  return url;
}

/** Pool settings from the environment. DATABASE_SSL=true enables TLS (use "no-verify" for self-signed certificates). */
export function poolConfig(url: string = getDatabaseUrl(), env: Record<string, string | undefined> = process.env): PoolConfig {
  const ssl = (env.DATABASE_SSL || '').trim().toLowerCase();
  return {
    connectionString: url,
    max: Number(env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(ssl === 'true' ? { ssl: true } : ssl === 'no-verify' ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

export function openDb(url: string = getDatabaseUrl()): { pool: Pool; db: Db } {
  const pool = new Pool(poolConfig(url));
  // An idle client dropping (DB restart / failover) must not crash the process; the pool reconnects.
  pool.on('error', (e) => console.error('[db] idle client error:', e.message));
  return { pool, db: drizzle(pool, { schema }) as unknown as Db };
}

const g = globalThis as unknown as { __disciplineDb?: { pool: Pool; db: Db } };

/** One shared pool per process (also survives Next.js dev hot reload). */
export function getDb(): Db {
  if (!g.__disciplineDb) g.__disciplineDb = openDb();
  return g.__disciplineDb.db;
}

export async function closeDb(): Promise<void> {
  const cur = g.__disciplineDb;
  g.__disciplineDb = undefined;
  if (cur) await cur.pool.end();
}
