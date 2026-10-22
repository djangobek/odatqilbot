import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { botIdOf, getBotToken } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  // botId is the public numeric id of the configured bot: compare it with the bot that opens the Mini App.
  const botId = botIdOf(getBotToken());
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ ok: true, botId });
  } catch {
    return NextResponse.json({ ok: false, botId }, { status: 503 });
  }
}
