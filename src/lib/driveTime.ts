// Estimates driving time from the Luck Images home base to a shoot address
// using the Google Distance Matrix API. Returns null if no API key is set or
// the lookup fails, so callers can degrade gracefully.

// Home base the photographer drives from. Change here if it moves.
export const HOME_BASE = "Monterey Ranch Apartments, Austin, TX";

export type DriveEstimate = { minutes: number; text: string; distanceText: string };

export async function getDriveTime(destination: string): Promise<DriveEstimate | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !destination?.trim()) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", HOME_BASE);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("departure_time", "now"); // enables traffic-aware duration
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const el = data?.rows?.[0]?.elements?.[0];
    if (!el || el.status !== "OK") return null;
    const dur = el.duration_in_traffic || el.duration;
    if (!dur?.value) return null;
    return {
      minutes: Math.round(dur.value / 60),
      text: dur.text,
      distanceText: el.distance?.text || "",
    };
  } catch {
    return null;
  }
}
