import { noteSchema } from '@/lib/validation';
import { HttpError } from '@/server/errors';
import { protectedRoute, readJson } from '@/server/http';
import { saveNote } from '@/server/records';

export const dynamic = 'force-dynamic';

export const PUT = protectedRoute(async ({ req, db, user, today }) => {
  const input = noteSchema.parse(await readJson(req));
  if (input.date > today) throw new HttpError(400, 'Kelajak uchun izoh yozib bo‘lmaydi');
  return { note: await saveNote(db, user.id, input) };
});
