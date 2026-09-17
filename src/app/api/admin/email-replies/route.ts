import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// Email replies logged by /api/webhooks/resend-inbound, for a contact's
// activity timeline. GET ?contact_id=<id>
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const contactId = new URL(req.url).searchParams.get("contact_id");
  if (!contactId) return NextResponse.json({ error: "contact_id required" }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("email_replies")
    .select("id, from_email, from_name, subject, body_text, received_at")
    .eq("contact_id", contactId)
    .order("received_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ replies: [], unavailable: true });
  return NextResponse.json({ replies: data || [] });
}
