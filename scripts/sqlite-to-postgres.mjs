// One-off data import: copies an existing SQLite database (the old discipline.db) into PostgreSQL.
//
//   DATABASE_URL=postgresql://... node scripts/sqlite-to-postgres.mjs ./data/discipline.db [--force]
//
// - The PostgreSQL schema must already exist:  npm run db:migrate
// - Original ids are preserved, identity sequences are advanced afterwards.
// - Refuses to run if the target already has data (use --force to truncate the target first).
// - Everything happens in ONE transaction: on any error nothing is written.
// - The SQLite file is opened read-only and is never modified.
// Requires the optional dependency better-sqlite3 (installed by `npm install` when a prebuilt binary or toolchain is available).
import fs from 'node:fs';
import pg from 'pg';

const args = process.argv.slice(2);
const force = args.includes('--force');
const sqlitePath = args.find((a) => !a.startsWith('--')) || process.env.SQLITE_PATH || process.env.DATABASE_PATH || './data/discipline.db';
const url = (process.env.DATABASE_URL || '').trim();
if (!url) { console.error('DATABASE_URL is not set.'); process.exit(1); }
if (!fs.existsSync(sqlitePath)) { console.error(`SQLite file not found: ${sqlitePath}`); process.exit(1); }

let Database;
try { Database = (await import('better-sqlite3')).default; }
catch { console.error('better-sqlite3 is not installed. Run `npm install` (optional dependency used only by this script).'); process.exit(1); }

const lite = new Database(sqlitePath, { readonly: true, fileMustExist: true });
const ssl = (process.env.DATABASE_SSL || '').trim().toLowerCase();
const client = new pg.Client({ connectionString: url, ...(ssl === 'true' ? { ssl: true } : ssl === 'no-verify' ? { ssl: { rejectUnauthorized: false } } : {}) });
await client.connect();

// Parents before children (foreign keys).
const TABLES = [
  { name: 'users', cols: ['id', 'telegram_id', 'display_name', 'username', 'language', 'timezone', 'reminders_enabled', 'created_at', 'updated_at'], bool: ['reminders_enabled'], defaults: { reminders_enabled: 1 } },
  { name: 'habits', cols: ['id', 'user_id', 'name', 'description', 'icon', 'category', 'start_date', 'end_date', 'reminder_time', 'archived', 'created_at', 'updated_at'], bool: ['archived'] },
  { name: 'habit_schedules', cols: ['id', 'habit_id', 'effective_from', 'weekdays'] },
  { name: 'habit_records', cols: ['id', 'user_id', 'habit_id', 'date', 'status', 'completed_at', 'note', 'created_at', 'updated_at'] },
  { name: 'daily_notes', cols: ['id', 'user_id', 'date', 'went_well', 'difficult', 'notes', 'created_at', 'updated_at'] },
  { name: 'reminder_deliveries', cols: ['id', 'user_id', 'habit_id', 'date', 'reminder_time', 'sent_at'], optional: true },
];

const q = (n) => `"${n}"`;
const liteHas = (t) => !!lite.prepare("select 1 from sqlite_master where type='table' and name=?").get(t);
const liteCols = (t) => new Set(lite.prepare(`pragma table_info(${q(t)})`).all().map((c) => c.name));
const BATCH = 500;
const summary = [];

try {
  await client.query('begin');

  const existing = (await client.query('select (select count(*) from users) u, (select count(*) from habits) h')).rows[0];
  if (Number(existing.u) + Number(existing.h) > 0) {
    if (!force) throw new Error('Target PostgreSQL database already contains data. Re-run with --force to truncate it first.');
    await client.query('truncate table reminder_deliveries, daily_notes, habit_records, habit_schedules, habits, users restart identity cascade');
  }

  for (const t of TABLES) {
    if (!liteHas(t.name)) {
      if (t.optional) { summary.push([t.name, 0, 0]); continue; }
      throw new Error(`SQLite table "${t.name}" is missing - is this the right file?`);
    }
    const have = liteCols(t.name);
    const rows = lite.prepare(`select * from ${q(t.name)} order by id`).all();
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const params = [];
      const tuples = chunk.map((row) => {
        const ph = t.cols.map((c) => {
          let v = have.has(c) ? row[c] : t.defaults?.[c];
          if (v === undefined) v = null;
          if (t.bool?.includes(c)) v = Boolean(v);
          params.push(v);
          return `$${params.length}`;
        });
        return `(${ph.join(',')})`;
      });
      await client.query(`insert into ${q(t.name)} (${t.cols.map(q).join(',')}) overriding system value values ${tuples.join(',')}`, params);
    }
    // Advance the identity so new rows do not collide with imported ids.
    await client.query(`select setval(pg_get_serial_sequence('${t.name}', 'id'), greatest((select coalesce(max(id), 0) from ${q(t.name)}), 1), (select count(*) > 0 from ${q(t.name)}))`);
    const got = Number((await client.query(`select count(*) c from ${q(t.name)}`)).rows[0].c);
    if (got !== rows.length) throw new Error(`Row count mismatch in ${t.name}: sqlite=${rows.length} postgres=${got}`);
    summary.push([t.name, rows.length, got]);
  }

  await client.query('commit');
  console.log('Import finished:');
  for (const [name, a, b] of summary) console.log(`  ${name.padEnd(20)} sqlite=${a}  postgres=${b}`);
} catch (e) {
  await client.query('rollback').catch(() => {});
  console.error(`Import failed, nothing was written: ${e.message}`);
  process.exitCode = 1;
} finally {
  lite.close();
  await client.end();
}
