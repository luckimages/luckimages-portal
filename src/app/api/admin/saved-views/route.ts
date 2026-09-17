import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Saved Contacts-list filter combinations ("Luxury agents", "KW Lakeway
// overdue"...), shared between Ryan and Leif.
// GET → { views }   POST { name, filters } → { view }   DELETE ?id=<id>
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createAdminClient().from("saved_contact_views").select("*").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ views: [], unavailable: true });
  return NextResponse.json({ views: data || [] });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, filters } = await req.json();
  const clean = String(name || "").trim().slice(0, 60);
  if (!clean) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("saved_contact_views")
    .insert({ name: clean, filters: filters && typeof filters === "object" ? filters : {}, created_by: admin.email?.split("@")[0] || null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ view: data });
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await createAdminClient().from("saved_contact_views").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
