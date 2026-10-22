import { parseId, protectedRoute, readJson } from '@/server/http';
import { sectionSchema } from '@/lib/validation';
import { deleteSection, renameSection } from '@/server/sections';

export const dynamic = 'force-dynamic';
type P = { id: string };

export const PATCH = protectedRoute<P>(async ({ req, db, user, params }) => {
  const { name } = sectionSchema.parse(await readJson(req));
  return { section: await renameSection(db, user.id, parseId(params.id), name) };
});

export const DELETE = protectedRoute<P>(async ({ db, user, params }) => {
  await deleteSection(db, user.id, parseId(params.id));
  return { ok: true };
});
