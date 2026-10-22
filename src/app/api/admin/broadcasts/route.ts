import { adminRoute, readJson } from "@/server/http";
import { audienceCounts, createBroadcast, listBroadcasts } from "@/server/broadcasts";
import { broadcastSchema } from "@/lib/validation";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async ({ db }) => ({ broadcasts: await listBroadcasts(db), audiences: await audienceCounts(db) }));

export const POST = adminRoute(async ({ db, user, req }) => {
  rateLimit(`broadcast:${user.id}`, 6, 60_000);
  const input = broadcastSchema.parse(await readJson(req));
  return { broadcast: await createBroadcast(db, user, input) };
});
