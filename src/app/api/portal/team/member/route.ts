import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const db = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCallerMembership(userId: string) {
  const { data: contact } = await db.from("contacts").select("id").eq("user_id", userId).single();
  if (!contact) return null;
  const { data: membership } = await db.from("team_members").select("team_id, role").eq("contact_id", contact.id).single();
  if (!membership) return null;
  return { contactId: contact.id, teamId: membership.team_id, role: membership.role as "lead" | "member" };
}

// PATCH — promote/demote another member (lead only). Body: { contactId, role }
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId: targetId, role } = await req.json();
  if (!targetId || !["lead", "member"].includes(role)) {
    return NextResponse.json({ error: "contactId and a valid role are required" }, { status: 400 });
  }

  const caller = await getCallerMembership(user.id);
  if (!caller) return NextResponse.json({ error: "Not in a team" }, { status: 400 });
  if (caller.role !== "lead") return NextResponse.json({ error: "Only a team lead can change roles" }, { status: 403 });

  const { data: target } = await db.from("team_members").select("id, role").eq("team_id", caller.teamId).eq("contact_id", targetId).single();
  if (!target) return NextResponse.json({ error: "That person isn't on this team" }, { status: 404 });

  // Don't allow demoting the last lead — someone always has to be able to
  // manage the team.
  if (target.role === "lead" && role === "member") {
    const { count } = await db.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", caller.teamId).eq("role", "lead");
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Promote another lead first — a team needs at least one." }, { status: 400 });
    }
  }

  const { error } = await db.from("team_members").update({ role }).eq("id", target.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — remove a member. A lead can remove anyone else; anyone can
// remove themselves (leave), except the sole remaining lead. Body: { contactId }
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId: targetId } = await req.json();
  if (!targetId) return NextResponse.json({ error: "contactId required" }, { status: 400 });

  const caller = await getCallerMembership(user.id);
  if (!caller) return NextResponse.json({ error: "Not in a team" }, { status: 400 });

  const isSelf = targetId === caller.contactId;
  if (!isSelf && caller.role !== "lead") {
    return NextResponse.json({ error: "Only a team lead can remove other members" }, { status: 403 });
  }

  const { data: target } = await db.from("team_members").select("id, role").eq("team_id", caller.teamId).eq("contact_id", targetId).single();
  if (!target) return NextResponse.json({ error: "That person isn't on this team" }, { status: 404 });

  if (target.role === "lead") {
    const { count } = await db.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", caller.teamId).eq("role", "lead");
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Promote another lead first — a team needs at least one." }, { status: 400 });
    }
  }

  const { error } = await db.from("team_members").delete().eq("id", target.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
