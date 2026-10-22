import { describe, expect, it } from 'vitest';
import { validateInitData } from '@/lib/telegram';
import { createToken, verifyToken } from '@/server/session';
import { BOT, signInitData } from './helpers';

const now = 1_800_000_000;
const user = JSON.stringify({ id: 42, first_name: 'Nurbek', username: 'nb' });

describe('Telegram initData', () => {
  it('accepts valid data', () => {
    const data = signInitData({ auth_date: String(now - 10), user, query_id: 'AA' });
    expect(validateInitData(data, BOT, 3600, now).id).toBe(42);
  });
  it('rejects a bad signature / wrong token', () => {
    const data = signInitData({ auth_date: String(now), user }, 'other:token');
    expect(() => validateInitData(data, BOT, 3600, now)).toThrow();
  });
  it('rejects tampered payload', () => {
    const data = signInitData({ auth_date: String(now), user }).replace('42', '43');
    expect(() => validateInitData(data, BOT, 3600, now)).toThrow();
  });
  it('rejects expired data', () => {
    const data = signInitData({ auth_date: String(now - 7200), user });
    expect(() => validateInitData(data, BOT, 3600, now)).toThrow(/muddati/);
  });
  it('rejects missing hash', () => {
    expect(() => validateInitData(`auth_date=${now}&user=${encodeURIComponent(user)}`, BOT, 3600, now)).toThrow();
  });
});

describe('Session token', () => {
  it('round-trips and rejects tampering/expiry', () => {
    const tok = createToken(7, now);
    expect(verifyToken(tok, now + 5)).toBe(7);
    expect(() => verifyToken(tok.replace(/^7/, '8'), now + 5)).toThrow();
    expect(() => verifyToken(tok, now + 60 * 60 * 24 * 8)).toThrow();
    expect(() => verifyToken('garbage', now)).toThrow();
  });
});
