import { protectedRoute, readJson } from '@/server/http';
import { createHabitSchema } from '@/lib/validation';
import { createHabit, loadHabitDefs } from '@/server/habits';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute(async ({ db, user }) => ({ habits: await loadHabitDefs(db, user.id) }));

export const POST = protectedRoute(async ({ req, db, user, today }) => {
  const input = createHabitSchema.parse(await readJson(req));
  return { habit: await createHabit(db, user.id, input, today) };
});
