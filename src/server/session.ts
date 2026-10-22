import { createHmac, timingSafeEqual } from 'node:crypto';
import { MIN_SECRET_LENGTH } from '../lib/env';
import { HttpError } from './errors';

const TTL_SEC = 60 * 60 * 24 * 7;

function secret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (s && s.length >= (process.env.NODE_ENV === 'production' ? MIN_SECRET_LENGTH : 16)) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is not configured (min 32 chars)');
  return 'dev-only-insecure-secret-change-me';
}
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function createToken(userId: number, nowSec = Math.floor(Date.now() / 1000)): string {
  const payload = `${userId}.${nowSec + TTL_SEC}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string, nowSec = Math.floor(Date.now() / 1000)): number {
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Sessiya noto‘g‘ri');
  const payload = `${parts[0]}.${parts[1]}`;
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, 'Sessiya noto‘g‘ri');
  if (Number(parts[1]) < nowSec) throw new HttpError(401, 'Sessiya muddati tugagan');
  const id = Number(parts[0]);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(401, 'Sessiya noto‘g‘ri');
  return id;
}
