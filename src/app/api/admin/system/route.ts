import { adminRoute, readJson } from "@/server/http";
import { getSettings, health, listAudit, setSettings } from "@/server/admin";
import { adminSettingsSchema } from "@/lib/validation";
import { adminTelegramIds, getBotToken, resolveWebAppUrl } from "@/lib/env";
import type { Db } from "@/db";

export const dynamic = "force-dynamic";

async function snapshot(db: Db) {
  const [settings, h, log] = await Promise.all([getSettings(db), health(db), listAudit(db)]);
  return {
    settings,
    health: { ...h, botConfigured: !!getBotToken(), appUrl: resolveWebAppUrl() ?? null, superAdmins: adminTelegramIds().length },
    audit: log,
  };
}

export const GET = adminRoute(({ db }) => snapshot(db));

export const PUT = adminRoute(async ({ db, user, req }) => {
  await setSettings(db, user, adminSettingsSchema.parse(await readJson(req)));
  return snapshot(db);
});
