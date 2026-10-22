import { adminRoute, parseId, readJson } from "@/server/http";
import { deleteUser, setBan, setRole, userDetail } from "@/server/admin";
import { adminUserActionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = adminRoute<{ id: string }>(({ db, params }) => userDetail(db, parseId(params.id)));

export const PATCH = adminRoute<{ id: string }>(async ({ db, user, req, params }) => {
  const id = parseId(params.id);
  const { action, reason } = adminUserActionSchema.parse(await readJson(req));
  if (action === "ban" || action === "unban") await setBan(db, user, id, action === "ban", reason);
  else await setRole(db, user, id, action === "promote" ? "admin" : "user");
  return userDetail(db, id);
});

export const DELETE = adminRoute<{ id: string }>(async ({ db, user, params }) => {
  await deleteUser(db, user, parseId(params.id));
  return { ok: true };
});
