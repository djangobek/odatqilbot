import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { createToken } from '@/server/session';
import { upsertTelegramUser } from '@/server/users';

export const dynamic = 'force-dynamic';

// Local development only. Disabled in production unless ALLOW_DEV_LOGIN=true (do not set it there).
export async function POST() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_LOGIN !== 'true') {
    return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
  }
  const user = await upsertTelegramUser(getDb(), { id: 1, first_name: 'Dev', username: 'dev' });
  return NextResponse.json({ token: createToken(user.id) });
}
