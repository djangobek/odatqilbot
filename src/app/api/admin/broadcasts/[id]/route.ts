import { adminRoute, parseId } from "@/server/http";
import { cancelBroadcast } from "@/server/broadcasts";

export const dynamic = "force-dynamic";

export const DELETE = adminRoute<{ id: string }>(async ({ db, user, params }) => {
  await cancelBroadcast(db, user, parseId(params.id));
  return { ok: true };
});
