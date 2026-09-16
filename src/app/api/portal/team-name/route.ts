import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveTeamInvite } from "@/lib/teamInvite";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Public, unauthenticated by design — shown on /join-team, /login, and
// /register before the invitee has an account. Looked up by the per-invite
// token (not the team's own id) so this can't be used to probe/confirm
// arbitrary team ids either.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const invite = await resolveTeamInvite(db, token);
  if (!invite) return NextResponse.json({ name: null });
  const { data } = await db.from("teams").select("name").eq("id", invite.team_id).single();
  return NextResponse.json({ name: data?.name || null, email: invite.email });
}
