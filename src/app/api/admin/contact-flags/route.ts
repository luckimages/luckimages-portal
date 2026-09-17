import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Ids of contacts who unsubscribed from marketing email or are marked Do Not
// Contact — for badges/filters on Contacts, Cold Calls, Outreach, and Mass
// Invite. Empty (not an error) if supabase-crm-phase1.sql hasn't been run.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("contacts")
    .select("id, do_not_contact, email_unsubscribed_at")
    .or("do_not_contact.eq.true,email_unsubscribed_at.not.is.null");
  if (error) return NextResponse.json({ unsubscribed: [], doNotContact: [], unavailable: true });

  return NextResponse.json({
    unsubscribed: (data || []).filter(c => c.email_unsubscribed_at).map(c => c.id),
    doNotContact: (data || []).filter(c => c.do_not_contact).map(c => c.id),
  });
}
