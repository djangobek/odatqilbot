import { HttpError } from '@/server/errors';
import { protectedRoute } from '@/server/http';
import { getStats, type RangeKey } from '@/server/queries';

export const dynamic = 'force-dynamic';
const RANGES: RangeKey[] = ['7d', '30d', 'month', 'all'];

export const GET = protectedRoute(({ req, db, user, today }) => {
  const range = (req.nextUrl.searchParams.get('range') ?? '7d') as RangeKey;
  if (!RANGES.includes(range)) throw new HttpError(400, 'Davr noto‘g‘ri');
  return getStats(db, user.id, range, today);
});
