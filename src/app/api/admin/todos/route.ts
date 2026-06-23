import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — active todos + completed history
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = service();
  const [{ data: active }, { data: completed }] = await Promise.all([
    db.from("todos").select("*").is("completed_at", null).order("created_at", { ascending: true }),
    db.from("todos").select("*").not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(50),
  ]);

  return NextResponse.json({ active: active || [], completed: completed || [] });
}

// POST — create / complete / delete
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, text, id, is_urgent } = await req.json();
  const db = service();
  const name = user.email?.split("@")[0] || "unknown";

  if (action === "create" && text?.trim()) {
    const { data, error } = await db.from("todos").insert({ text: text.trim(), created_by: name, is_urgent: !!is_urgent }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ todo: data });
  }

  if (action === "complete" && id) {
    const { error } = await db.from("todos").update({ completed_at: new Date().toISOString(), completed_by: name }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete" && id) {
    const { error } = await db.from("todos").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
