import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

// Maps short link-tracking keys to real Nocturne routes.
// Keep in sync with SERVICES slugs in src/lib/services.tsx.
const SERVICE_URLS: Record<string, string> = {
  photo: `${SITE_URL}/services/listing-photos`,
  "listing-photos": `${SITE_URL}/services/listing-photos`,
  drone: `${SITE_URL}/drone`,
  matterport: `${SITE_URL}/services/matterport`,
  twilight: `${SITE_URL}/services/twilight`,
  "virtual-staging": `${SITE_URL}/services/virtual-staging`,
  video: `${SITE_URL}/services/video`,
  floorplan: `${SITE_URL}/services/floorplans`,
  floorplans: `${SITE_URL}/services/floorplans`,
  brochures: `${SITE_URL}/services/brochures`,
  pricing: `${SITE_URL}/pricing`,
  home: SITE_URL,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const service = searchParams.get("service") || "";
  const contactId = searchParams.get("contact");

  const destination = SERVICE_URLS[service];
  if (!destination) {
    return NextResponse.redirect(SITE_URL, { status: 302 });
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  await db.from("link_clicks").insert({ contact_id: contactId || null, service });

  return NextResponse.redirect(destination, { status: 302 });
}
