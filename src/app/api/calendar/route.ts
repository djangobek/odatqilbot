import { isValidMonth } from '@/lib/dates';
import { HttpError } from '@/server/errors';
import { protectedRoute } from '@/server/http';
import { getMonth } from '@/server/queries';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute(async ({ req, db, user, today }) => {
  const month = req.nextUrl.searchParams.get('month') ?? today.slice(0, 7);
  if (!isValidMonth(month)) throw new HttpError(400, 'Oy noto‘g‘ri');
  return getMonth(db, user.id, month, today);
});
