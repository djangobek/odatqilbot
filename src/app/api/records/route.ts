import { recordSchema } from '@/lib/validation';
import { protectedRoute, readJson } from '@/server/http';
import { setRecord } from '@/server/records';

export const dynamic = 'force-dynamic';

export const POST = protectedRoute(async ({ req, db, user, today }) => {
  const input = recordSchema.parse(await readJson(req));
  const r = await setRecord(db, user.id, input, today);
  return { record: { habitId: r.habitId, date: r.date, status: r.status, completedAt: r.completedAt } };
});
