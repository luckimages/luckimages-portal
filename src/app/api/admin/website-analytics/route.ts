import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10) || 30, 1), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const db = createAdminClient();

  const [{ data: views, error }, { data: profiles }] = await Promise.all([
    db
      .from("page_views")
      .select("path, referrer, session_id, duration_seconds, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false }),
    db
      .from("profiles")
      .select("id, role, created_at")
      .gte("created_at", since),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = views ?? [];

  const uniqueVisitors = new Set(rows.map((r) => r.session_id)).size;
  const pageviews = rows.length;

  const durations = rows.map((r) => r.duration_seconds).filter((d): d is number => typeof d === "number" && d > 0);
  const avgDurationSeconds = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const pathCounts: Record<string, number> = {};
  for (const r of rows) pathCounts[r.path] = (pathCounts[r.path] || 0) + 1;
  const topPages = Object.entries(pathCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const referrerCounts: Record<string, number> = {};
  for (const r of rows) {
    let ref = "Direct";
    if (r.referrer) {
      try {
        const host = new URL(r.referrer).hostname.replace(/^www\./, "");
        if (!host.includes("luckimages.com")) ref = host;
      } catch { /* ignore malformed referrer */ }
    }
    referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
  }
  const topReferrers = Object.entries(referrerCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const dailyCounts: Record<string, { visitors: Set<string>; views: number }> = {};
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    if (!dailyCounts[day]) dailyCounts[day] = { visitors: new Set(), views: 0 };
    dailyCounts[day].visitors.add(r.session_id);
    dailyCounts[day].views += 1;
  }
  const dailyTraffic = Object.entries(dailyCounts)
    .map(([date, v]) => ({ date, visitors: v.visitors.size, views: v.views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const newRegistrations = (profiles ?? []).filter((p) => p.role !== "admin").length;

  return NextResponse.json({
    days,
    uniqueVisitors,
    pageviews,
    avgDurationSeconds,
    topPages,
    topReferrers,
    dailyTraffic,
    newRegistrations,
  });
}
