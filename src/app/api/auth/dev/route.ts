import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { createToken } from '@/server/session';
import { upsertTelegramUser } from '@/server/users';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Local development only. Disabled in production unless ALLOW_DEV_LOGIN=true (do not set it there).
export async function POST() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_LOGIN !== 'true') {
    return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
  }
  const db = getDb();
  const user = await upsertTelegramUser(db, { id: 1, first_name: 'Dev', username: 'dev' });
  // The local dev user is an admin so the admin panel can be tried without Telegram.
  if (user.role !== 'admin') await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
  return NextResponse.json({ token: createToken(user.id) });
}
