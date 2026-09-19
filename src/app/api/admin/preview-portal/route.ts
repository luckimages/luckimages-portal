import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { teamLogoUrl } from "@/lib/teamLogoUrl";

// Read-only admin preview of a specific contact's client portal — lets an
// admin see exactly what a realtor sees (shoots, invoices, team, profile)
// without needing their password or a real login as them. Mirrors the same
// data-loading logic /client runs for the logged-in user, but keyed off an
// explicit contactId under admin authority instead of the caller's own
// session. Never returns anything that would let the browser act as this
// contact — the /client page treats this response as view-only.
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contactId = new URL(req.url).searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });

  const db = createAdminClient();

  const { data: contact } = await db
    .from("contacts")
    .select("id, name, email, phone, brokerage, lead_source, user_id")
    .eq("id", contactId)
    .single();
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  let memberSince: string | null = null;
  let hasPassword = true;
  let userMeta: Record<string, unknown> = {};
  if (contact.user_id) {
    const { data: { user } } = await db.auth.admin.getUserById(contact.user_id);
    if (user) {
      userMeta = user.user_metadata || {};
      hasPassword = user.user_metadata?.has_password === true;
      const created = new Date(user.created_at);
      const now = new Date();
      const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      memberSince = years > 0 ? `${years}y ${remMonths}m` : `${remMonths} month${remMonths !== 1 ? "s" : ""}`;
    }
  }

  // Team membership (same shape as /api/portal/team)
  let team = null;
  let teamMembers: unknown[] = [];
  let myTeamRole: string | null = null;
  const { data: membership } = await db.from("team_members").select("team_id, role").eq("contact_id", contact.id).single();
  if (membership) {
    myTeamRole = membership.role;
    const { data: teamRow } = await db.from("teams").select("id, name, brokerage").eq("id", membership.team_id).single();
    if (teamRow) team = { ...teamRow, logo_url: teamLogoUrl(teamRow.id) };
    const { data: members } = await db
      .from("team_members")
      .select("contact_id, role, joined_at, contacts(id, name, email, phone)")
      .eq("team_id", membership.team_id)
      .order("joined_at");
    teamMembers = members || [];
  }

  const teamContactIds = [contact.id, ...teamMembers.map((m) => (m as { contact_id: string }).contact_id).filter(id => id !== contact.id)];
  const orParts = [
    ...(contact.user_id ? [`client_id.eq.${contact.user_id}`] : []),
    ...teamContactIds.map(id => `contact_id.eq.${id}`),
  ];
  const orFilter = orParts.join(",");

  const [{ data: shoots }, { data: invoices }] = await Promise.all([
    db.from("shoots").select("*").or(orFilter).neq("status", "cancelled").order("scheduled_at", { ascending: false }),
    db.from("invoices").select("*").or(orFilter).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    contact: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      brokerage: contact.brokerage,
      areas: userMeta.areas || "",
      birthday: userMeta.birthday || "",
      mailingList: userMeta.mailing_list || false,
      referralSource: contact.lead_source || userMeta.referral_source || "",
    },
    memberSince,
    hasPassword,
    team,
    teamMembers,
    myTeamRole,
    shoots: shoots || [],
    invoices: invoices || [],
  });
}
