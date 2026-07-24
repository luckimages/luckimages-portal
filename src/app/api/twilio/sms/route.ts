import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { findContactIdByPhone } from "@/lib/twilio";

// Inbound SMS webhook — every text sent to the business number lands here
// and gets attached to the matching contact's thread automatically.
export async function POST(req: Request) {
  const form = await req.formData();
  const from = form.get("From")?.toString() || null;
  const to = form.get("To")?.toString() || null;
  const body = form.get("Body")?.toString() || "";
  const messageSid = form.get("MessageSid")?.toString() || null;

  const db = createAdminClient();
  const contactId = await findContactIdByPhone(from);

  await db.from("messages").insert({
    contact_id: contactId,
    direction: "inbound",
    from_number: from,
    to_number: to,
    body,
    status: "received",
    twilio_sid: messageSid,
  });

  // Empty TwiML — no auto-reply by default (missed-call auto-text lives on
  // the voice side; a two-way SMS auto-reply could be added here later).
  return new NextResponse("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
}
