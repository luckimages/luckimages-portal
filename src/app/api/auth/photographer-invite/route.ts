import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

// Validates/consumes a photographer invite token server-side with the
// service-role key. Previously the register page queried
// photographer_invites directly from the browser with the anon key,
// which required a "select using (true)" RLS policy — that policy let
// anyone list every pending invite (name/email/token), not just the one
// matching their token. Routing through here lets that policy be removed
// entirely while keeping the invite flow working.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false });

  const db = createAdminClient();
  const { data } = await db.from("photographer_invites").select("name, used").eq("token", token).maybeSingle();
  if (!data || data.used) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, name: data.name || "" });
}

export async function POST(req: Request) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });

  const db = createAdminClient();
  const { data } = await db
    .from("photographer_invites")
    .update({ used: true })
    .eq("token", token)
    .eq("used", false)
    .select("id")
    .maybeSingle();

  return NextResponse.json({ ok: !!data });
}
