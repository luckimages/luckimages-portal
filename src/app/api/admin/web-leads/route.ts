import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET() {
  const { data, error } = await db()
    .from("web_leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
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
