// Manual logical backup with pg_dump (custom format). Requires the PostgreSQL client tools (pg_dump) on PATH.
// In production prefer your provider's automated backups (Railway Postgres: Backups tab); this is for ad-hoc dumps.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const url = (process.env.DATABASE_URL || '').trim();
if (!url) {
  console.error('[backup] DATABASE_URL is not set.');
  process.exit(1);
}
const dir = process.env.BACKUP_DIR || './backups';
fs.mkdirSync(dir, { recursive: true });
const dest = path.join(dir, `discipline-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);

const r = spawnSync('pg_dump', ['--format=custom', '--no-owner', '--file', dest, url], { stdio: 'inherit' });
if (r.error) {
  console.error(`[backup] could not run pg_dump (${r.error.message}). Install the PostgreSQL client tools.`);
  process.exit(1);
}
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`[backup] ${dest}  (restore: pg_restore --clean --no-owner -d "$DATABASE_URL" ${dest})`);
