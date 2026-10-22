import { protectedRoute, readJson } from '@/server/http';
import { sectionSchema } from '@/lib/validation';
import { createSection, listSections } from '@/server/sections';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute(async ({ db, user }) => ({ sections: await listSections(db, user.id) }));

export const POST = protectedRoute(async ({ req, db, user }) => {
  const { name } = sectionSchema.parse(await readJson(req));
  return { section: await createSection(db, user.id, name) };
});
