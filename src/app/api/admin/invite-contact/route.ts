import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { sendAdminEmail } from "@/lib/sendAdminEmail";
import { buildPortalInviteEmail } from "@/lib/portalInviteEmail";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId } = await req.json();
  if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });

  const service = createAdminClient();

  const { data: contact } = await service.from("contacts").select("id, name, email, phone").eq("id", contactId).single();
  if (!contact?.email) return NextResponse.json({ error: "Contact has no email" }, { status: 400 });

  // Same registration email Mass Invite sends — just triggered from this
  // contact's profile instead of the bulk-select page.
  const { subject, html } = buildPortalInviteEmail(contact);

  const result = await sendAdminEmail(service, admin, {
    contactId,
    to: contact.email,
    subject,
    html,
    category: "Portal Invite",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.skipped ? { skipped: true, reason: result.reason } : {}) },
      { status: result.status }
    );
  }

  return NextResponse.json({ ok: true });
}
