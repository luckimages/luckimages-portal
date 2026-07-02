import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — ?mode=week (default) or ?mode=all
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "week";
  const db = service();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [{ data: active }, entriesQuery] = await Promise.all([
    db.from("time_entries").select("*").eq("user_id", user.id).is("stopped_at", null).maybeSingle(),
    mode === "all"
      ? db.from("time_entries").select("*").order("started_at", { ascending: false })
      : db.from("time_entries").select("user_id, user_name, duration_seconds, started_at, stopped_at").gte("started_at", weekStart.toISOString()),
  ]);

  return NextResponse.json({ active, weekEntries: mode === "week" ? (entriesQuery.data || []) : [], allEntries: mode === "all" ? (entriesQuery.data || []) : [] });
}

// POST — start or stop
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, entryId, elapsed, userName } = await req.json();
  const db = service();

  if (action === "start") {
    const { data, error } = await db
      .from("time_entries")
      .insert({ user_id: user.id, user_name: userName || user.email?.split("@")[0] || "Unknown", started_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: data });
  }

  if (action === "stop" && entryId) {
    const { error } = await db
      .from("time_entries")
      .update({ stopped_at: new Date().toISOString(), duration_seconds: elapsed })
      .eq("id", entryId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
