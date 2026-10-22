// Production entrypoint: validates env, runs migrations, starts Next.js and supervises the Telegram bot.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const env = { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' };
const production = env.NODE_ENV === 'production';
const clean = (v) => (v && v.trim()) || '';

// ---- resolve the public app URL: WEB_APP_URL -> NEXT_PUBLIC_APP_URL -> Railway domain
function normalizeUrl(raw) {
  const v = clean(raw);
  if (!v) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
  } catch { return ''; }
}
const webAppUrl = normalizeUrl(env.WEB_APP_URL) || normalizeUrl(env.NEXT_PUBLIC_APP_URL) || normalizeUrl(env.RAILWAY_PUBLIC_DOMAIN) || normalizeUrl(env.RAILWAY_STATIC_URL);
if (webAppUrl) env.WEB_APP_URL = webAppUrl; // children inherit the resolved value

if (production) {
  const problems = [];
  if (!clean(env.DATABASE_URL)) problems.push('DATABASE_URL is missing (add a PostgreSQL service and reference its DATABASE_URL).');
  if (!clean(env.BOT_TOKEN)) problems.push('BOT_TOKEN is missing.');
  if (!webAppUrl) problems.push('WEB_APP_URL is missing (or generate a Railway public domain).');
  else if (!webAppUrl.startsWith('https://')) problems.push('WEB_APP_URL must be https://');
  if (clean(env.SESSION_SECRET).length < 32) problems.push('SESSION_SECRET must be set and at least 32 characters (openssl rand -hex 32).');
  if (clean(env.ALLOW_DEV_LOGIN) === 'true') problems.push('ALLOW_DEV_LOGIN must not be true in production.');
  if (problems.length) {
    console.error(`[start] Invalid configuration:\n - ${problems.join('\n - ')}`);
    process.exit(1);
  }
}

console.log('[start] Applying database migrations...');
const migration = spawnSync(process.execPath, [path.join(root, 'scripts', 'migrate.mjs')], { cwd: root, env, stdio: 'inherit' });
if (migration.status !== 0) process.exit(migration.status ?? 1);

let shuttingDown = false;
const children = new Map();

function launch(label, script, args = []) {
  const child = spawn(process.execPath, [script, ...args], { cwd: root, env, stdio: 'inherit' });
  children.set(label, child);
  return child;
}

// ---- web: if it dies the whole service exits so Railway restarts it
const web = launch('web', path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), ['start', '-H', '0.0.0.0', '-p', String(env.PORT || '3000')]);
web.once('exit', (code, signal) => {
  if (!shuttingDown) {
    console.error(`[start] web exited (code=${code}, signal=${signal}).`);
    shutdown(code || 1);
  }
});

// ---- bot: restarted with backoff; never takes the web app down
const BOT_FATAL = 78;
let botDelay = 2000;
function startBot() {
  if (shuttingDown) return;
  const startedAt = Date.now();
  const bot = launch('bot', path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), ['src/bot/index.ts']);
  bot.once('exit', (code, signal) => {
    if (shuttingDown) return;
    if (code === BOT_FATAL) {
      console.error('[start] bot configuration error; not restarting (web app keeps running). Fix the variables and redeploy.');
      return;
    }
    botDelay = Date.now() - startedAt > 60_000 ? 2000 : Math.min(botDelay * 2, 60_000);
    console.error(`[start] bot exited (code=${code}, signal=${signal}); restarting in ${botDelay / 1000}s`);
    setTimeout(startBot, botDelay);
  });
}
if (clean(env.BOT_TOKEN)) startBot();
else console.warn('[start] BOT_TOKEN is empty; running web app only (not allowed in production).');

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children.values()) if (c.exitCode === null) c.kill('SIGTERM');
  const force = setTimeout(() => { for (const c of children.values()) if (c.exitCode === null) c.kill('SIGKILL'); process.exit(code); }, 8000);
  force.unref();
  const poll = setInterval(() => {
    if ([...children.values()].every((c) => c.exitCode !== null || c.signalCode !== null)) { clearInterval(poll); process.exit(code); }
  }, 100);
}
process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
