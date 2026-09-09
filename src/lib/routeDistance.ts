// Driving distance for a multi-stop route (photographer home → shoots → home).
//
// Prefers OpenRouteService (free, no billing — set OPENROUTESERVICE_API_KEY),
// then Google Directions if GOOGLE_MAPS_API_KEY is set, then a straight-line
// (haversine) estimate × 1.3 so the feature still works with no key at all.

export type LatLng = { lat: number; lng: number };
export type RouteLeg = { from: string; to: string; miles: number };
export type RouteResult = { totalMiles: number; legs: RouteLeg[]; source: "openrouteservice" | "google" | "haversine" };

const MI_PER_METER = 0.000621371;
const HAVERSINE_ROAD_FACTOR = 1.3;

function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613; // earth radius, miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function haversineRoute(points: LatLng[], labels: string[]): RouteResult {
  const legs: RouteLeg[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const miles = haversineMiles(points[i], points[i + 1]) * HAVERSINE_ROAD_FACTOR;
    legs.push({ from: labels[i], to: labels[i + 1], miles: round1(miles) });
    total += miles;
  }
  return { totalMiles: round1(total), legs, source: "haversine" };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

async function orsRoute(points: LatLng[], labels: string[]): Promise<RouteResult | null> {
  const key = process.env.OPENROUTESERVICE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: points.map(p => [p.lng, p.lat]) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    const segs: { distance: number }[] = route?.segments || [];
    if (!route?.summary?.distance) return null;

    const legs: RouteLeg[] = segs.map((s, i) => ({
      from: labels[i], to: labels[i + 1], miles: round1(s.distance * MI_PER_METER),
    }));
    return { totalMiles: round1(route.summary.distance * MI_PER_METER), legs, source: "openrouteservice" };
  } catch {
    return null;
  }
}

async function googleRoute(points: LatLng[], labels: string[]): Promise<RouteResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || points.length < 2) return null;
  try {
    const origin = points[0];
    const dest = points[points.length - 1];
    const waypoints = points.slice(1, -1);
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
    url.searchParams.set("destination", `${dest.lat},${dest.lng}`);
    if (waypoints.length) url.searchParams.set("waypoints", waypoints.map(w => `${w.lat},${w.lng}`).join("|"));
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    const rlegs: { distance?: { value: number } }[] = route?.legs || [];
    if (!rlegs.length) return null;
    const legs: RouteLeg[] = rlegs.map((l, i) => ({
      from: labels[i], to: labels[i + 1], miles: round1((l.distance?.value || 0) * MI_PER_METER),
    }));
    const total = rlegs.reduce((s, l) => s + (l.distance?.value || 0), 0) * MI_PER_METER;
    return { totalMiles: round1(total), legs, source: "google" };
  } catch {
    return null;
  }
}

// `stops` are the ordered points to visit BETWEEN leaving home and returning.
// Pass labels 1:1 with [origin, ...stops, origin].
export async function routeDistance(origin: LatLng, stops: LatLng[], labels: string[]): Promise<RouteResult> {
  const points = [origin, ...stops, origin];
  if (points.length < 2) return { totalMiles: 0, legs: [], source: "haversine" };

  return (
    (await orsRoute(points, labels)) ||
    (await googleRoute(points, labels)) ||
    haversineRoute(points, labels)
  );
}
