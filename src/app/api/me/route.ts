import { protectedRoute } from '@/server/http';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute(({ user, today }) => ({
  user: { id: user.id, displayName: user.displayName, timezone: user.timezone, language: user.language },
  today,
}));
