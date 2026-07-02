import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Real, confirmed-live pages on luckimages.com (Squarespace-hosted marketing site).
// Keep this in sync with the actual site's URL structure — verify before adding new entries.
const SERVICE_URLS: Record<string, string> = {
  photo: "https://www.luckimages.com/photo",
  drone: "https://www.luckimages.com/drone",
  matterport: "https://www.luckimages.com/360",
  twilight: "https://www.luckimages.com/twilight",
  "virtual-staging": "https://www.luckimages.com/virtual-staging",
  video: "https://www.luckimages.com/reels",
  floorplan: "https://www.luckimages.com/pricing",
  pricing: "https://www.luckimages.com/pricing",
  home: "https://www.luckimages.com",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const service = searchParams.get("service") || "";
  const contactId = searchParams.get("contact");

  const destination = SERVICE_URLS[service];
  if (!destination) {
    return NextResponse.redirect("https://www.luckimages.com", { status: 302 });
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  await db.from("link_clicks").insert({ contact_id: contactId || null, service });

  return NextResponse.redirect(destination, { status: 302 });
}
