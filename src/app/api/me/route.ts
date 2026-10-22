import { protectedRoute, readJson } from '@/server/http';
import { settingsSchema } from '@/lib/validation';
import { updateSettings } from '@/server/users';
import { getSettings } from '@/server/admin';

export const dynamic = 'force-dynamic';

const view = (user: { id: number; displayName: string; timezone: string; language: string; remindersEnabled: boolean; morningDigest: boolean; eveningDigest: boolean; role: 'user' | 'admin' }) => ({
  id: user.id, displayName: user.displayName, timezone: user.timezone, language: user.language,
  remindersEnabled: user.remindersEnabled, morningDigest: user.morningDigest, eveningDigest: user.eveningDigest, role: user.role,
});

export const GET = protectedRoute(async ({ db, user, today }) => ({ user: view(user), today, announcement: (await getSettings(db)).announcement || null }));

export const PATCH = protectedRoute(async ({ req, db, user, today }) => {
  const next = await updateSettings(db, user.id, settingsSchema.parse(await readJson(req)));
  return { user: view(next), today, announcement: (await getSettings(db)).announcement || null };
});
