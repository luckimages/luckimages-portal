import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Website contact-form submissions and quote requests (written by
// /api/contact and /api/quote) for the Command Center's "Website Inquiries"
// box, or for one contact's activity timeline with ?contact_id=.
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contactId = new URL(req.url).searchParams.get("contact_id");
  const db = createAdminClient();
  // select("*") so this keeps working before and after supabase-crm-phase1.sql
  // adds kind / contact_id / square_footage / quote_total.
  let query = db.from("contact_inquiries").select("*").order("created_at", { ascending: false }).limit(50);
  if (contactId) query = query.eq("contact_id", contactId);
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inquiries: data || [] });
}
