// Applies pending PostgreSQL migrations only. Never drops or resets data.
// Retries for a while so the app can start while the database is still booting (Railway / Docker Compose).
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = (process.env.DATABASE_URL || '').trim();
if (!url) {
  console.error('[migrate] DATABASE_URL is not set. Example: postgresql://user:pass@host:5432/dbname');
  process.exit(1);
}
const ssl = (process.env.DATABASE_SSL || '').trim().toLowerCase();
const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 10_000,
  ...(ssl === 'true' ? { ssl: true } : ssl === 'no-verify' ? { ssl: { rejectUnauthorized: false } } : {}),
});
pool.on('error', () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ATTEMPTS = Number(process.env.MIGRATE_ATTEMPTS) || 20;

let lastError;
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  try {
    // Advisory lock: two instances starting at once cannot run the same migration twice.
    const client = await pool.connect();
    try {
      await client.query('select pg_advisory_lock(727001)');
      await migrate(drizzle(client), { migrationsFolder: './drizzle' });
    } finally {
      await client.query('select pg_advisory_unlock(727001)').catch(() => {});
      client.release();
    }
    lastError = undefined;
    break;
  } catch (e) {
    lastError = e;
    const transient = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', '57P03', '08006', '08001'].includes(e?.code) || /timeout|terminated/i.test(e?.message ?? '');
    if (!transient || attempt === ATTEMPTS) break;
    console.warn(`[migrate] database not ready (${e.code || e.message}); retry ${attempt}/${ATTEMPTS - 1} in 3s`);
    await sleep(3000);
  }
}
await pool.end().catch(() => {});
if (lastError) {
  console.error('[migrate] failed:', lastError.message);
  process.exit(1);
}
console.log('[migrate] OK');
