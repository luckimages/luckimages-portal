import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const db = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — fetch the team the current contact belongs to (if any)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contact } = await db.from("contacts").select("id").eq("user_id", user.id).single();
  if (!contact) return NextResponse.json({ team: null });

  const { data: membership } = await db
    .from("team_members")
    .select("team_id")
    .eq("contact_id", contact.id)
    .single();

  if (!membership) return NextResponse.json({ team: null });

  const { data: team } = await db
    .from("teams")
    .select("id, name, brokerage")
    .eq("id", membership.team_id)
    .single();

  const { data: members } = await db
    .from("team_members")
    .select("contact_id, joined_at, contacts(id, name, email, phone)")
    .eq("team_id", membership.team_id)
    .order("joined_at");

  return NextResponse.json({ team, members: members || [] });
}

// POST — create a team + add creator as first member, then invite teammate
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamName, inviteEmail, inviteName } = await req.json();
  if (!teamName?.trim()) return NextResponse.json({ error: "Team name required" }, { status: 400 });
  if (!inviteEmail?.trim()) return NextResponse.json({ error: "Invite email required" }, { status: 400 });

  const { data: contact } = await db.from("contacts").select("id, name, brokerage").eq("user_id", user.id).single();
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // Check not already in a team
  const { data: existing } = await db.from("team_members").select("team_id").eq("contact_id", contact.id).single();
  if (existing) return NextResponse.json({ error: "Already in a team" }, { status: 400 });

  // Create team
  const { data: team, error: teamErr } = await db.from("teams").insert({
    name: teamName.trim(),
    brokerage: contact.brokerage || null,
    created_by: contact.id,
  }).select().single();
  if (teamErr || !team) return NextResponse.json({ error: "Failed to create team" }, { status: 500 });

  // Add creator as first member
  await db.from("team_members").insert({ team_id: team.id, contact_id: contact.id, invited_by: contact.id });

  // Send invite to teammate
  await sendTeamInvite({ team, inviterName: contact.name, inviteEmail, inviteName });

  return NextResponse.json({ ok: true, team });
}

// PATCH — existing team member invites a new teammate
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteEmail, inviteName } = await req.json();
  if (!inviteEmail?.trim()) return NextResponse.json({ error: "Invite email required" }, { status: 400 });

  const { data: contact } = await db.from("contacts").select("id, name").eq("user_id", user.id).single();
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const { data: membership } = await db.from("team_members").select("team_id").eq("contact_id", contact.id).single();
  if (!membership) return NextResponse.json({ error: "Not in a team" }, { status: 400 });

  const { data: team } = await db.from("teams").select("id, name, brokerage").eq("id", membership.team_id).single();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  await sendTeamInvite({ team, inviterName: contact.name, inviteEmail, inviteName });

  return NextResponse.json({ ok: true });
}

async function sendTeamInvite({ team, inviterName, inviteEmail, inviteName }: {
  team: { id: string; name: string };
  inviterName: string;
  inviteEmail: string;
  inviteName: string;
}) {
  const SITE_URL = "https://www.luckimages.com";
  const params = new URLSearchParams({ team_id: team.id });
  const joinUrl = `${SITE_URL}/join-team?${params.toString()}`;
  const firstName = (inviteName || inviteEmail).split(" ")[0];

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#000;font-family:Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:48px 0;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#0c0c0c;border:1px solid #222;padding:48px;">
      <tr><td>
        <img src="${SITE_URL}/logo.png" width="40" height="40" alt="Luck Images" style="display:block;margin:0 auto 24px;border:0;" />
        <h1 style="margin:0 0 8px;font-size:28px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;color:#fff;text-align:center;">${team.name}</h1>
        <p style="margin:0 0 32px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#555;text-align:center;">Team Invitation</p>
        <p style="margin:0 0 24px;font-size:14px;color:#888;line-height:1.6;">Hey ${firstName},</p>
        <p style="margin:0 0 24px;font-size:14px;color:#888;line-height:1.6;">${inviterName} has invited you to join the <strong style="color:#fff;">${team.name}</strong> team on the Luck Images client portal.</p>
        <p style="margin:0 0 32px;font-size:14px;color:#888;line-height:1.6;">Once you register, you'll share access to team shoots, media, and invoices — all under one roof.</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 32px;">
          <a href="${joinUrl}" style="display:inline-block;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:16px 32px;text-decoration:none;">Join the Team →</a>
        </td></tr></table>
        <p style="margin:0;font-size:11px;color:#333;text-align:center;">Luck Images · Austin, TX · luckimages.com</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "Luck Images <ryan@luckimages.com>",
      to: [inviteEmail],
      subject: `${inviterName} invited you to join ${team.name} on Luck Images`,
      html,
    }),
  });
}
