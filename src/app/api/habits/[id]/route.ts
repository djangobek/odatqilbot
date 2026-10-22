import { archiveSchema, updateHabitSchema } from '@/lib/validation';
import { deleteHabit, setArchived, updateHabit } from '@/server/habits';
import { parseId, protectedRoute, readJson } from '@/server/http';

export const dynamic = 'force-dynamic';
type P = { id: string };

/** Body with only { archived } archives/restores; otherwise edits fields. */
export const PATCH = protectedRoute<P>(async ({ req, db, user, params, today }) => {
  const id = parseId(params.id);
  const body = await readJson(req);
  if (body && typeof body === 'object' && Object.keys(body).length === 1 && 'archived' in body) {
    return { habit: await setArchived(db, user.id, id, archiveSchema.parse(body).archived, today) };
  }
  return { habit: await updateHabit(db, user.id, id, updateHabitSchema.parse(body), today) };
});

export const DELETE = protectedRoute<P>(async ({ db, user, params }) => {
  await deleteHabit(db, user.id, parseId(params.id));
  return { ok: true };
});
