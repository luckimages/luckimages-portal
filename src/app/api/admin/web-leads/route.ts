import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

function db() {
  return createAdminClient();
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await db()
    .from("web_leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, email } = await req.json();
  if (!id || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Create contact from lead
  const { data: contact, error: contactErr } = await db()
    .from("contacts")
    .insert({ name, email: email || null, type: "lead", stage: "new" })
    .select()
    .single();
  if (contactErr) return NextResponse.json({ error: contactErr.message }, { status: 500 });

  // Mark lead as converted
  await db().from("web_leads").update({ converted_contact_id: contact.id }).eq("id", id);

  return NextResponse.json({ contact });
}
