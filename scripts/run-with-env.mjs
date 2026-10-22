// Load optional .env.local for standalone Node scripts without an extra dependency.
// Existing process environment variables always take precedence (important in production).
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const envFile = '.env.local';
if (fs.existsSync(envFile)) {
  for (const rawLine of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error('Usage: node scripts/run-with-env.mjs <script> [args...]');
  process.exit(2);
}
const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
