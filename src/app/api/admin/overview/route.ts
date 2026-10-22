import { adminRoute } from "@/server/http";
import { overview } from "@/server/admin";

export const dynamic = "force-dynamic";
export const GET = adminRoute(({ db }) => overview(db));
