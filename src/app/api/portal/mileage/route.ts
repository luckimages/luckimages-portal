import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { mileageDb, recomputeMileageForDay } from "@/lib/mileage";

// A photographer views their own mileage days and confirms / adjusts the
// estimated miles for a day.

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = mileageDb();
  const { data: days } = await db
    .from("mileage_days")
    .select("*")
    .eq("photographer_id", user.id)
    .order("day", { ascending: false })
    .limit(200);

  // Address labels for each day's shoots
  const shootIds = [...new Set((days ?? []).flatMap(d => d.shoot_ids || []))];
  const addrById: Record<string, string> = {};
  if (shootIds.length) {
    const { data: shoots } = await db.from("shoots").select("id, address").in("id", shootIds);
    for (const s of shoots ?? []) addrById[s.id] = s.address;
  }

  const enriched = (days ?? []).map(d => ({
    ...d,
    shoot_addresses: (d.shoot_ids || []).map((id: string) => addrById[id] || "").filter(Boolean),
  }));

  return NextResponse.json({ days: enriched });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { day, actualMiles, confirmEstimate } = await req.json();
  if (!day) return NextResponse.json({ error: "day required" }, { status: 400 });

  const db = mileageDb();
  const { data: row } = await db.from("mileage_days")
    .select("id, estimated_miles").eq("photographer_id", user.id).eq("day", day).maybeSingle();
  if (!row) return NextResponse.json({ error: "No mileage on file for that day" }, { status: 404 });

  // confirmEstimate = accept the computed number; otherwise store their override
  const actual = confirmEstimate ? (row.estimated_miles ?? null) : Number(actualMiles);
  if (!confirmEstimate && (!Number.isFinite(actual) || actual < 0)) {
    return NextResponse.json({ error: "Enter a valid mileage" }, { status: 400 });
  }

  await db.from("mileage_days").update({
    actual_miles: actual,
    confirmed_at: new Date().toISOString(),
    confirmed_by: user.email || "photographer",
  }).eq("id", row.id);

  // Re-run so effective_miles / gas / deduction / per-shoot allocation update
  await recomputeMileageForDay(db, user.id, day);

  const { data: updated } = await db.from("mileage_days").select("*").eq("id", row.id).single();
  return NextResponse.json({ ok: true, day: updated });
}
