import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const tgUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().default(''),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});
export type TelegramUser = z.infer<typeof tgUserSchema>;

export class TelegramAuthError extends Error {}

/** Official Telegram Mini App validation: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
export function validateInitData(initData: string, botToken: string, maxAgeSec: number, nowSec = Math.floor(Date.now() / 1000)): TelegramUser {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) throw new TelegramAuthError('Imzo topilmadi');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new TelegramAuthError('Imzo noto‘g‘ri');

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) throw new TelegramAuthError('auth_date yo‘q');
  if (authDate > nowSec + 60) throw new TelegramAuthError('auth_date kelajakda');
  if (nowSec - authDate > maxAgeSec) throw new TelegramAuthError('Autentifikatsiya muddati tugagan');

  try {
    return tgUserSchema.parse(JSON.parse(params.get('user') ?? ''));
  } catch {
    throw new TelegramAuthError('Foydalanuvchi ma’lumoti noto‘g‘ri');
  }
}
