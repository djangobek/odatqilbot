import { adminRoute } from "@/server/http";
import { listUsers } from "@/server/admin";
import { adminUsersQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const GET = adminRoute(({ db, req }) => {
  const q = adminUsersQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return listUsers(db, q);
});
