import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const db = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await req.json();
  if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });

  const { data: contact } = await db.from("contacts").select("id").eq("user_id", user.id).single();
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const { data: team } = await db.from("teams").select("id, name").eq("id", teamId).single();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // Already a member? No-op.
  const { data: existing } = await db.from("team_members").select("id").eq("team_id", teamId).eq("contact_id", contact.id).single();
  if (existing) return NextResponse.json({ ok: true, alreadyMember: true });

  // If contact is already in a different team, don't double-join
  const { data: otherTeam } = await db.from("team_members").select("team_id").eq("contact_id", contact.id).single();
  if (otherTeam) return NextResponse.json({ error: "Already in another team" }, { status: 400 });

  await db.from("team_members").insert({ team_id: teamId, contact_id: contact.id });

  await db.from("company_updates").insert({
    message: `👥 ${user.user_metadata?.full_name || user.email} joined team "${team.name}"`,
    created_by: "system",
    category: "nocturne",
    link: `/admin/contacts`,
  });

  return NextResponse.json({ ok: true });
}
