import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/db';
import { getBotToken } from '@/lib/env';
import { telegramAuthSchema } from '@/lib/validation';
import { TelegramAuthError, validateInitData } from '@/lib/telegram';
import { clientIp, errorResponse, readJson } from '@/server/http';
import { HttpError } from '@/server/errors';
import { rateLimit } from '@/server/rate-limit';
import { createToken } from '@/server/session';
import { upsertTelegramUser } from '@/server/users';

export const dynamic = 'force-dynamic';

// What the person can do about each failure (shown in the app next to the short code).
const HINT: Record<string, string> = {
  bad_signature: 'Ilova boshqa bot orqali ochilgan yoki serverdagi BOT_TOKEN noto‘g‘ri.',
  expired: 'Kirish muddati tugagan. Ilovani botdan qayta oching.',
  future_date: 'Telefoningizdagi sana/vaqt noto‘g‘ri. Avtomatik vaqtni yoqing.',
  no_hash: 'Telegram ma’lumot yubormadi. Ilovani bot tugmasi orqali oching.',
  no_auth_date: 'Telegram ma’lumoti to‘liq emas. Ilovani qayta oching.',
  bad_user: 'Telegram ma’lumoti to‘liq emas. Ilovani qayta oching.',
};

export async function POST(req: NextRequest) {
  try {
    rateLimit(`auth:${clientIp(req)}`, 30, 60_000);
    const { initData, timezone } = telegramAuthSchema.parse(await readJson(req));
    const botToken = getBotToken();
    if (!botToken) throw new HttpError(503, 'Server sozlanmagan: BOT_TOKEN yo‘q', 'no_bot_token');
    const maxAge = Number(process.env.TELEGRAM_AUTH_MAX_AGE) || 7 * 86400;
    let tg;
    try {
      tg = validateInitData(initData, botToken, maxAge);
    } catch (e) {
      if (e instanceof TelegramAuthError) {
        console.warn(`[auth] rejected: ${e.code}`);
        throw new HttpError(401, HINT[e.code] ?? 'Telegram autentifikatsiyasi muvaffaqiyatsiz', e.code);
      }
      throw e;
    }
    const user = await upsertTelegramUser(getDb(), tg, timezone);
    return NextResponse.json({ token: createToken(user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
