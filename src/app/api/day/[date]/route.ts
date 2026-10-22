import { isValidDate } from '@/lib/dates';
import { HttpError } from '@/server/errors';
import { protectedRoute } from '@/server/http';
import { getDay } from '@/server/queries';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute<{ date: string }>(({ db, user, params, today }) => {
  if (!isValidDate(params.date)) throw new HttpError(400, 'Sana noto‘g‘ri');
  return getDay(db, user.id, params.date, today);
});
