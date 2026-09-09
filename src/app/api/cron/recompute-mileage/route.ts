import { NextResponse } from "next/server";
import { mileageDb, recomputeMileageForDay } from "@/lib/mileage";

export const maxDuration = 60;

// Safety net — recomputes photographer mileage for the recent window so
// nothing is missed if a shoot change didn't trigger a live recompute (or a
// route API was down at the time). Live recompute happens on confirm / edit /
// cancel; this just backstops it.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = mileageDb();

  const now = new Date();
  const days: string[] = [];
  for (let d = -2; d <= 3; d++) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + d);
    days.push(dt.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }));
  }

  const from = new Date(now); from.setDate(from.getDate() - 3);
  const to = new Date(now); to.setDate(to.getDate() + 4);
  const { data: shoots } = await db
    .from("shoots")
    .select("scheduled_at, photographer_ids, status")
    .gte("scheduled_at", from.toISOString())
    .lte("scheduled_at", to.toISOString())
    .neq("status", "cancelled");

  const pairs = new Set<string>();
  for (const s of shoots ?? []) {
    const day = new Date(s.scheduled_at).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    if (!days.includes(day)) continue;
    for (const pid of s.photographer_ids || []) pairs.add(`${pid}|${day}`);
  }

  let ok = 0, failed = 0;
  for (const pair of pairs) {
    const [pid, day] = pair.split("|");
    try { await recomputeMileageForDay(db, pid, day); ok++; }
    catch (e) { console.error("recompute-mileage cron:", pair, e); failed++; }
  }

  return NextResponse.json({ recomputed: ok, failed, pairs: pairs.size });
}
