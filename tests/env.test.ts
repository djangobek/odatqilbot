import { describe, expect, it } from 'vitest';
import { botLink, normalizeUrl, publicConfig, resolveWebAppUrl, validateProductionEnv, webAppLink } from '@/lib/env';

describe('environment links', () => {
  it('normalizes URLs', () => {
    expect(normalizeUrl(' https://app.example.com/ ')).toBe('https://app.example.com');
    expect(normalizeUrl('app.example.com')).toBe('https://app.example.com');
    expect(normalizeUrl('')).toBeUndefined();
    expect(normalizeUrl('http://')).toBeUndefined();
  });
  it('prefers WEB_APP_URL, then NEXT_PUBLIC_APP_URL, then the Railway domain', () => {
    expect(resolveWebAppUrl({ WEB_APP_URL: 'https://a.com', RAILWAY_PUBLIC_DOMAIN: 'b.up.railway.app' })).toBe('https://a.com');
    expect(resolveWebAppUrl({ NEXT_PUBLIC_APP_URL: 'https://c.com' })).toBe('https://c.com');
    expect(resolveWebAppUrl({ RAILWAY_PUBLIC_DOMAIN: 'b.up.railway.app' })).toBe('https://b.up.railway.app');
    expect(resolveWebAppUrl({})).toBeUndefined();
  });
  it('builds page and bot links from env', () => {
    expect(webAppLink('/habits', { WEB_APP_URL: 'https://a.com/' })).toBe('https://a.com/habits');
    expect(webAppLink('', { WEB_APP_URL: 'https://a.com' })).toBe('https://a.com');
    expect(botLink({ BOT_USERNAME: '@my_bot' })).toBe('https://t.me/my_bot');
    expect(publicConfig({ WEB_APP_URL: 'https://a.com', BOT_USERNAME: 'x_bot' })).toMatchObject({ appUrl: 'https://a.com', botUrl: 'https://t.me/x_bot', supportUrl: null });
  });
  it('validates production configuration', () => {
    const ok = { DATABASE_URL: 'postgresql://u:p@h:5432/d', BOT_TOKEN: '1:abc', WEB_APP_URL: 'https://a.com', SESSION_SECRET: 'x'.repeat(32), NODE_ENV: 'production' };
    expect(validateProductionEnv(ok)).toEqual([]);
    expect(validateProductionEnv({ ...ok, SESSION_SECRET: 'short' })).toHaveLength(1);
    expect(validateProductionEnv({ ...ok, WEB_APP_URL: 'http://a.com' })).toHaveLength(1);
    expect(validateProductionEnv({ ...ok, ALLOW_DEV_LOGIN: 'true' })).toHaveLength(1);
    expect(validateProductionEnv({ ...ok, DATABASE_URL: ' ' })).toHaveLength(1);
    expect(validateProductionEnv({})).toHaveLength(4);
  });
});
