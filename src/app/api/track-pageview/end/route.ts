import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

// Hit via navigator.sendBeacon when a visitor leaves a page, so it must be
// POST-only (beacons can't use other verbs) and must not block unload.
export async function POST(req: Request) {
  const { id, duration } = await req.json();
  if (!id || typeof duration !== "number") return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const db = createAdminClient();
  await db.from("page_views").update({ duration_seconds: Math.max(0, Math.round(duration)) }).eq("id", id);
  return NextResponse.json({ ok: true });
}
