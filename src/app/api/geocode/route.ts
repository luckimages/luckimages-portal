import { NextResponse } from "next/server";

// Proxies OpenStreetMap's free Nominatim geocoder server-side — it has no API
// key, but its usage policy asks that lookups come from a backend (not
// hammered directly from browsers) with an identifying User-Agent, and stay
// to reasonable, non-bulk volume. Fine for a small business's booking form.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json([]);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "LuckImagesPortal/1.0 (https://www.luckimages.com; ryan@luckimages.com)" },
    });
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    const results = (data as Array<{ display_name: string; lat: string; lon: string }>).map(r => ({
      displayName: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
