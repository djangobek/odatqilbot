import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { getDb, type Db } from '../db';
import type { User } from '../db/schema';
import { todayIn } from '../lib/dates';
import { HttpError } from './errors';
import { verifyToken } from './session';
import { authenticateUser } from './users';
import { rateLimit } from './rate-limit';

export type Ctx<P> = { req: NextRequest; db: Db; user: User; params: P; today: string };

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? 'Ma’lumot noto‘g‘ri' }, { status: 400 });
  console.error('[api] unexpected error:', e instanceof Error ? e.message : 'unknown');
  return NextResponse.json({ error: 'Serverda xatolik yuz berdi' }, { status: 500 });
}

export async function authenticate(db: Db, req: NextRequest): Promise<User> {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) throw new HttpError(401, 'Kirish talab qilinadi');
  const user = await authenticateUser(db, verifyToken(h.slice(7)));
  if (!user) throw new HttpError(401, 'Foydalanuvchi topilmadi');
  return user;
}

/** Wraps a handler: server-side auth, params, validation errors and safe error messages. */
export function protectedRoute<P = Record<string, never>>(fn: (c: Ctx<P>) => unknown | Promise<unknown>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      const db = getDb();
      const user = await authenticate(db, req);
      const params = await ctx.params;
      rateLimit(`user:${user.id}`, 300, 60_000);
      const body = await fn({ req, db, user, params, today: todayIn(user.timezone) });
      return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

const MAX_BODY_BYTES = 64 * 1024;

export async function readJson(req: NextRequest): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'So‘rov hajmi juda katta');
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'So‘rov hajmi juda katta');
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'JSON noto‘g‘ri');
  }
}

/** Railway's proxy sets x-real-ip; fall back to the first forwarded address. */
export const clientIp = (req: NextRequest) =>
  req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

export function parseId(v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'ID noto‘g‘ri');
  return n;
}
