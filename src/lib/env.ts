/**
 * Single source of truth for every environment-derived value and link.
 * Pure Node (no framework imports) so Next.js server code and the bot process share it.
 * Never import this from client components: it reads server-only variables.
 */
type Env = Record<string, string | undefined>;

const clean = (v: string | undefined): string | undefined => {
  const s = v?.trim();
  return s ? s : undefined;
};
const stripSlash = (s: string) => s.replace(/\/+$/, '');

/** Accepts "https://x.com", "x.com" or "x.com/" and returns a normalized origin+path without trailing slash. */
export function normalizeUrl(raw: string | undefined): string | undefined {
  const v = clean(raw);
  if (!v) return undefined;
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    return stripSlash(`${u.origin}${u.pathname}`);
  } catch {
    return undefined;
  }
}

/**
 * Public HTTPS address of the Mini App.
 * Priority: WEB_APP_URL -> NEXT_PUBLIC_APP_URL -> Railway's RAILWAY_PUBLIC_DOMAIN (auto-provided).
 */
export function resolveWebAppUrl(env: Env = process.env): string | undefined {
  return (
    normalizeUrl(env.WEB_APP_URL) ??
    normalizeUrl(env.NEXT_PUBLIC_APP_URL) ??
    normalizeUrl(clean(env.RAILWAY_PUBLIC_DOMAIN)) ??
    normalizeUrl(clean(env.RAILWAY_STATIC_URL))
  );
}

/** Link to a page of the Mini App, e.g. webAppLink('/habits'). */
export function webAppLink(path = '', env: Env = process.env): string | undefined {
  const base = resolveWebAppUrl(env);
  if (!base) return undefined;
  const p = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${base}${p}`;
}

/** https://t.me/<BOT_USERNAME>; BOT_USERNAME may be written with or without "@". */
export function botLink(env: Env = process.env): string | undefined {
  const name = clean(env.BOT_USERNAME)?.replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '');
  return name ? `https://t.me/${name}` : undefined;
}

/**
 * BOT_TOKEN exactly as Telegram expects it. Hosting dashboards often leave a trailing newline/space,
 * wrap the value in quotes or the person pastes "bot123:ABC" (from an API URL). Any of those silently breaks
 * the initData signature check, so the web app and the bot both read the token through here.
 */
export function getBotToken(env: Env = process.env): string | undefined {
  let v = clean(env.BOT_TOKEN);
  if (!v) return undefined;
  v = v.replace(/^['"`]+|['"`]+$/g, '').trim().replace(/^bot(?=\d+:)/i, '');
  return v || undefined;
}

/** The numeric part before ":" is the public bot id (safe to show; useful to spot a wrong token). */
export const botIdOf = (token: string | undefined) => token?.split(':')[0] ?? null;

/** Telegram ids (comma/space separated) that are always admins. Set ADMIN_TELEGRAM_IDS=123456789,987654321 */
export function adminTelegramIds(env: Env = process.env): number[] {
  return (clean(env.ADMIN_TELEGRAM_IDS) ?? '').split(/[\s,;]+/).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0);
}
export const isSuperAdmin = (telegramId: number, env: Env = process.env) => adminTelegramIds(env).includes(telegramId);

export const supportLink = (env: Env = process.env) => normalizeUrl(env.SUPPORT_URL);
export const channelLink = (env: Env = process.env) => normalizeUrl(env.CHANNEL_URL);

/** Public, non-secret configuration exposed to the browser through /api/config. */
export function publicConfig(env: Env = process.env) {
  return {
    appUrl: resolveWebAppUrl(env) ?? null,
    botUrl: botLink(env) ?? null,
    supportUrl: supportLink(env) ?? null,
    channelUrl: channelLink(env) ?? null,
  };
}

export const isProduction = (env: Env = process.env) => env.NODE_ENV === 'production';

export const MIN_SECRET_LENGTH = 32;

/** Returns a list of human-readable problems. Empty list means the configuration is usable. */
export function validateProductionEnv(env: Env = process.env): string[] {
  const problems: string[] = [];
  if (!clean(env.DATABASE_URL)) problems.push('DATABASE_URL is missing (PostgreSQL connection string; on Railway: ${{Postgres.DATABASE_URL}}).');
  if (!getBotToken(env)) problems.push('BOT_TOKEN is missing (create a bot with @BotFather).');
  const url = resolveWebAppUrl(env);
  if (!url) problems.push('WEB_APP_URL is missing (or enable a Railway public domain so RAILWAY_PUBLIC_DOMAIN is set).');
  else if (!url.startsWith('https://')) problems.push('WEB_APP_URL must be an https:// URL.');
  const secret = clean(env.SESSION_SECRET);
  if (!secret) problems.push('SESSION_SECRET is missing (openssl rand -hex 32).');
  else if (secret.length < MIN_SECRET_LENGTH) problems.push(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  if (adminTelegramIds(env).length === 0) problems.push('ADMIN_TELEGRAM_IDS is missing (your numeric Telegram id, e.g. from @userinfobot): without it nobody can open the admin panel.');
  if (clean(env.ALLOW_DEV_LOGIN) === 'true') problems.push('ALLOW_DEV_LOGIN=true must not be set in production.');
  return problems;
}
