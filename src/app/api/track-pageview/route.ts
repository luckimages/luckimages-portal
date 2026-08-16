import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const { path, referrer, sessionId, userAgent, userId, linkClickId } = await req.json();
  if (!path || !sessionId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Vercel's edge network adds these geo headers automatically -- no IP
  // storage or external geolocation lookup needed.
  const country = req.headers.get("x-vercel-ip-country");
  const region = req.headers.get("x-vercel-ip-country-region");
  const city = req.headers.get("x-vercel-ip-city");

  const db = createAdminClient();
  const payload: Record<string, unknown> = {
    path,
    referrer: referrer || null,
    session_id: sessionId,
    user_agent: userAgent || null,
    country: country || null,
    region: region || null,
    city: city ? decodeURIComponent(city) : null,
    user_id: userId || null,
    link_click_id: linkClickId || null,
  };

  let { data, error } = await db.from("page_views").insert(payload).select("id").single();

  if (error) {
    console.error("[track-pageview] insert error:", error.message, "| link_click_id:", payload.link_click_id ?? "none");
    if (error.message?.includes("link_click_id")) {
      delete payload.link_click_id;
      ({ data, error } = await db.from("page_views").insert(payload).select("id").single());
      if (error) console.error("[track-pageview] retry without link_click_id also failed:", error.message);
    }
  } else {
    if (payload.link_click_id) console.log("[track-pageview] saved with link_click_id:", payload.link_click_id);
  }

  if (error || !data) return NextResponse.json({ error: error?.message || "Insert failed" }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
