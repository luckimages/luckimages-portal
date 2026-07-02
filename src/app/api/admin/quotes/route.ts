import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

function db() {
  return createAdminClient();
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contact_id");
  const all = searchParams.get("all") === "1";

  if (all) {
    const { data, error } = await db()
      .from("quotes")
      .select("*, contacts(name, email)")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (!contactId) return NextResponse.json({ error: "contact_id or all=1 required" }, { status: 400 });
  const { data, error } = await db()
    .from("quotes")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contact_id, address, sqft, primary_service, primary_price, addons, total, sent } = await req.json();
  if (!primary_service) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const { data, error } = await db()
    .from("quotes")
    .insert({ contact_id, address, sqft, primary_service, primary_price, addons, total, sent: !!sent, sent_at: sent ? new Date().toISOString() : null })
    .select("*, contacts(name, email)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
