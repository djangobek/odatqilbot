import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/db';
import { telegramAuthSchema } from '@/lib/validation';
import { TelegramAuthError, validateInitData } from '@/lib/telegram';
import { clientIp, errorResponse, readJson } from '@/server/http';
import { HttpError } from '@/server/errors';
import { rateLimit } from '@/server/rate-limit';
import { createToken } from '@/server/session';
import { upsertTelegramUser } from '@/server/users';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    rateLimit(`auth:${clientIp(req)}`, 30, 60_000);
    const { initData, timezone } = telegramAuthSchema.parse(await readJson(req));
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) throw new Error('BOT_TOKEN is not configured');
    const maxAge = Number(process.env.TELEGRAM_AUTH_MAX_AGE) || 86400;
    let tg;
    try {
      tg = validateInitData(initData, botToken, maxAge);
    } catch (e) {
      if (e instanceof TelegramAuthError) throw new HttpError(401, 'Telegram autentifikatsiyasi muvaffaqiyatsiz');
      throw e;
    }
    const user = await upsertTelegramUser(getDb(), tg, timezone);
    return NextResponse.json({ token: createToken(user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
