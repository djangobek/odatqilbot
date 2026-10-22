import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { authenticate, errorResponse } from "@/server/http";
import { HttpError } from "@/server/errors";
import { exportUsersCsv } from "@/server/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const admin = await authenticate(db, req);
    if (admin.role !== "admin") throw new HttpError(403, "Faqat adminlar uchun", "forbidden");
    const csv = await exportUsersCsv(db, admin);
    return new NextResponse(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
