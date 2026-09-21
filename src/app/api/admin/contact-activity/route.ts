import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Per-registered-contact portal activity, derived from page_views (tracked
// on /client since PageTracker stopped excluding it). GET with no params
// returns a summary (last online + visit count) for every user_id that has
// any activity — used by the contacts list. GET ?userId=<id> returns that
// one person's full visit-by-visit history instead.
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const userId = new URL(req.url).searchParams.get("userId");

  if (userId) {
    const { data, error } = await db
      .from("page_views")
      .select("id, path, created_at, duration_seconds")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ visits: data ?? [] });
  }

  const { data, error } = await db
    .from("page_views")
    .select("user_id, created_at")
    .not("user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary: Record<string, { lastOnline: string; visitCount: number }> = {};
  for (const row of data ?? []) {
    const uid = row.user_id as string;
    if (!summary[uid]) summary[uid] = { lastOnline: row.created_at, visitCount: 0 };
    summary[uid].visitCount++;
  }

  return NextResponse.json({ summary });
}
