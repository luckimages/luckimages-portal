import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const contactId = new URL(req.url).searchParams.get("contact_id");
  if (!contactId) return NextResponse.json({ error: "contact_id required" }, { status: 400 });
  const { data, error } = await db().from("quotes").select("*").eq("contact_id", contactId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { contact_id, sqft, primary_service, primary_price, addons, total } = await req.json();
  if (!contact_id || !primary_service) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const { data, error } = await db().from("quotes").insert({ contact_id, sqft, primary_service, primary_price, addons, total }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
