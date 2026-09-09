import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { mileageDb, recomputeMileageWindow } from "@/lib/mileage";

// A photographer views / edits their own profile (home base + vehicle, used
// for mileage tracking). Auth is the logged-in user editing their own
// profiles row — never anyone else's.

const FIELDS = ["home_address", "home_lat", "home_lng", "car_year", "car_make", "car_model", "car_mpg"] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = mileageDb();
  const { data } = await db.from("profiles")
    .select("full_name, phone, home_address, home_lat, home_lng, car_year, car_make, car_model, car_mpg")
    .eq("id", user.id).maybeSingle();

  return NextResponse.json({ profile: data || {} });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const db = mileageDb();

  const patch: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) patch[f] = body[f] === "" ? null : body[f];
  if ("phone" in body) patch.phone = body.phone || null;

  // Coerce numerics
  for (const k of ["home_lat", "home_lng", "car_mpg"] as const) {
    if (patch[k] != null) { const n = Number(patch[k]); patch[k] = Number.isFinite(n) ? n : null; }
  }
  if (patch.car_year != null) { const n = parseInt(String(patch.car_year), 10); patch.car_year = Number.isFinite(n) ? n : null; }

  const homeChanged = "home_lat" in patch || "home_lng" in patch || "home_address" in patch;

  const { error } = await db.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If the home base moved, re-run the mileage math for their shoots.
  if (homeChanged) {
    try { await recomputeMileageWindow(db, user.id); }
    catch (e) { console.error("photographer-profile: mileage recompute failed", e); }
  }

  return NextResponse.json({ ok: true });
}
