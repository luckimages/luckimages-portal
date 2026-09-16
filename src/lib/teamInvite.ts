import { SupabaseClient } from "@supabase/supabase-js";

const INVITE_TTL_DAYS = 14;

export type TeamInvite = { team_id: string; email: string };

// Looks up a still-valid (unused, not expired) invite by its token. Used
// both for the pre-signup "what team is this?" display and, more strictly,
// at actual join time.
export async function resolveTeamInvite(db: SupabaseClient, token: string | null | undefined): Promise<TeamInvite | null> {
  if (!token) return null;
  const { data } = await db.from("team_invites").select("team_id, email, used, created_at").eq("token", token).maybeSingle();
  if (!data || data.used) return null;
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (ageMs > INVITE_TTL_DAYS * 24 * 60 * 60 * 1000) return null;
  return { team_id: data.team_id, email: data.email };
}

export async function markTeamInviteUsed(db: SupabaseClient, token: string): Promise<void> {
  await db.from("team_invites").update({ used: true }).eq("token", token);
}
