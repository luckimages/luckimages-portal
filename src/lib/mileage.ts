import { createClient as createServiceClient, SupabaseClient } from "@supabase/supabase-js";
import { routeDistance, LatLng } from "@/lib/routeDistance";

// Photographer mileage: for a given photographer + day, route
//   home -> each of that day's shoots (in time order) -> home
// store the day total in mileage_days, then split miles + gas cost + IRS
// deduction evenly across that day's shoots into shoot_mileage.

export function mileageDb(): SupabaseClient {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const DEFAULT_GAS_PRICE = 2.75;
const DEFAULT_IRS_RATE = 0.70;

async function getSettings(db: SupabaseClient): Promise<{ gasPrice: number; irsRate: number }> {
  const { data } = await db.from("admin_settings").select("key,value").in("key", ["gas_price_per_gallon", "irs_mileage_rate"]);
  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.key] = r.value;
  return {
    gasPrice: parseFloat(map.gas_price_per_gallon) || DEFAULT_GAS_PRICE,
    irsRate: parseFloat(map.irs_mileage_rate) || DEFAULT_IRS_RATE,
  };
}

async function geocode(address: string): Promise<LatLng | null> {
  if (!address?.trim()) return null;
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "us");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "LuckImagesPortal/1.0 (https://www.luckimages.com; ryan@luckimages.com)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.[0];
    if (!r) return null;
    return { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
  } catch {
    return null;
  }
}

function dayBounds(dayISO: string): { start: string; end: string } {
  // dayISO is "YYYY-MM-DD" in America/Chicago terms; use a wide UTC window and
  // filter precisely below.
  const start = new Date(`${dayISO}T00:00:00-06:00`);
  const end = new Date(`${dayISO}T23:59:59-05:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function localDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // YYYY-MM-DD
}

type MileageShoot = { id: string; address: string; scheduled_at: string; lat: number | null; lng: number | null };

export async function recomputeMileageForDay(db: SupabaseClient, photographerId: string, dayISO: string): Promise<void> {
  const { data: profile } = await db
    .from("profiles")
    .select("home_address, home_lat, home_lng, car_mpg")
    .eq("id", photographerId)
    .maybeSingle();

  const { start, end } = dayBounds(dayISO);
  const { data: rawShoots } = await db
    .from("shoots")
    .select("id, address, scheduled_at, lat, lng, status, photographer_ids")
    .gte("scheduled_at", start)
    .lte("scheduled_at", end)
    .neq("status", "cancelled");

  const shoots: MileageShoot[] = (rawShoots ?? [])
    .filter(s => (s.photographer_ids || []).includes(photographerId) && localDay(s.scheduled_at) === dayISO)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const clearDay = async () => {
    const { data: md } = await db.from("mileage_days").select("id").eq("photographer_id", photographerId).eq("day", dayISO).maybeSingle();
    if (md?.id) await db.from("shoot_mileage").delete().eq("mileage_day_id", md.id);
    await db.from("mileage_days").delete().eq("photographer_id", photographerId).eq("day", dayISO);
  };

  const home: LatLng | null = (profile?.home_lat != null && profile?.home_lng != null)
    ? { lat: profile.home_lat, lng: profile.home_lng }
    : null;

  if (!home || shoots.length === 0) {
    await clearDay();
    return;
  }

  // Resolve each shoot's coordinates (pin first, geocode fallback).
  const stops: LatLng[] = [];
  const labels: string[] = ["Home"];
  for (const s of shoots) {
    let pt: LatLng | null = (s.lat != null && s.lng != null) ? { lat: s.lat, lng: s.lng } : null;
    if (!pt) pt = await geocode(s.address);
    if (!pt) { await clearDay(); return; } // can't route without every stop
    stops.push(pt);
    labels.push(s.address.split(",")[0] || s.address);
  }
  labels.push("Home");

  const route = await routeDistance(home, stops, labels);
  const { gasPrice, irsRate } = await getSettings(db);
  const mpg = profile?.car_mpg && profile.car_mpg > 0 ? Number(profile.car_mpg) : null;

  // Keep a photographer's confirmed override if they set one.
  const { data: existing } = await db.from("mileage_days").select("id, actual_miles, confirmed_at, confirmed_by").eq("photographer_id", photographerId).eq("day", dayISO).maybeSingle();
  const actualMiles: number | null = existing?.actual_miles ?? null;
  const effective = actualMiles ?? route.totalMiles;

  const gasCostCents = mpg ? Math.round((effective / mpg) * gasPrice * 100) : null;
  const deductionCents = Math.round(effective * irsRate * 100);

  const { data: dayRow } = await db.from("mileage_days").upsert({
    ...(existing?.id ? { id: existing.id } : {}),
    photographer_id: photographerId,
    day: dayISO,
    origin_address: profile?.home_address ?? null,
    origin_lat: home.lat,
    origin_lng: home.lng,
    shoot_ids: shoots.map(s => s.id),
    estimated_miles: route.totalMiles,
    actual_miles: actualMiles,
    effective_miles: effective,
    route_source: route.source,
    legs: route.legs,
    gas_price_cents: Math.round(gasPrice * 100),
    mpg,
    irs_rate_cents: Math.round(irsRate * 100),
    gas_cost_cents: gasCostCents,
    deduction_cents: deductionCents,
    computed_at: new Date().toISOString(),
    confirmed_at: existing?.confirmed_at ?? null,
    confirmed_by: existing?.confirmed_by ?? null,
  }, { onConflict: "photographer_id,day" }).select("id").single();

  const n = shoots.length;
  const perMiles = Math.round((effective / n) * 100) / 100;
  const perGas = gasCostCents != null ? Math.round(gasCostCents / n) : 0;
  const perDed = Math.round(deductionCents / n);

  // Replace this day's allocations.
  if (dayRow?.id) await db.from("shoot_mileage").delete().eq("mileage_day_id", dayRow.id);
  await db.from("shoot_mileage").delete().eq("photographer_id", photographerId).eq("day", dayISO);

  await db.from("shoot_mileage").insert(shoots.map(s => ({
    shoot_id: s.id,
    photographer_id: photographerId,
    mileage_day_id: dayRow?.id ?? null,
    day: dayISO,
    allocated_miles: perMiles,
    allocated_gas_cents: perGas,
    allocated_deduction_cents: perDed,
    updated_at: new Date().toISOString(),
  })));
}

// Recompute every (photographer, day) touched by a shoot — used after a shoot
// is confirmed, rescheduled, reassigned, or cancelled. `extraPhotographerIds`
// covers photographers removed from the shoot (their day changed too).
export async function recomputeMileageForShoot(
  db: SupabaseClient,
  shootId: string,
  opts: { extraPhotographerIds?: string[]; extraDays?: string[] } = {}
): Promise<void> {
  const { data: shoot } = await db.from("shoots").select("scheduled_at, photographer_ids").eq("id", shootId).maybeSingle();

  const days = new Set<string>(opts.extraDays ?? []);
  if (shoot?.scheduled_at) days.add(localDay(shoot.scheduled_at));

  const photographerIds = new Set<string>([...(shoot?.photographer_ids ?? []), ...(opts.extraPhotographerIds ?? [])]);

  for (const pid of photographerIds) {
    for (const day of days) {
      try { await recomputeMileageForDay(db, pid, day); }
      catch (e) { console.error("recomputeMileageForDay failed", pid, day, e); }
    }
  }
}

// Recompute a rolling window for one photographer — used when they change
// their home address or vehicle.
export async function recomputeMileageWindow(db: SupabaseClient, photographerId: string, daysBack = 45, daysFwd = 90): Promise<void> {
  const from = new Date(); from.setDate(from.getDate() - daysBack);
  const to = new Date(); to.setDate(to.getDate() + daysFwd);
  const { data: shoots } = await db
    .from("shoots")
    .select("scheduled_at, photographer_ids, status")
    .gte("scheduled_at", from.toISOString())
    .lte("scheduled_at", to.toISOString())
    .neq("status", "cancelled");
  const days = new Set<string>();
  for (const s of shoots ?? []) {
    if ((s.photographer_ids || []).includes(photographerId)) days.add(localDay(s.scheduled_at));
  }
  for (const day of days) {
    try { await recomputeMileageForDay(db, photographerId, day); }
    catch (e) { console.error("recomputeMileageWindow failed", photographerId, day, e); }
  }
}
