import { NextResponse } from "next/server";
import { requireAdmin, createAdminClient } from "@/lib/supabase-server";
import { getTwilioClient, isTwilioConfigured, toE164 } from "@/lib/twilio";

export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isTwilioConfigured()) return NextResponse.json({ error: "Twilio isn't configured yet" }, { status: 503 });

  const { contactId, body } = await req.json();
  if (!contactId || !body?.trim()) return NextResponse.json({ error: "contactId and body required" }, { status: 400 });

  const db = createAdminClient();
  const { data: contact } = await db.from("contacts").select("id, phone").eq("id", contactId).single();
  const toNumber = toE164(contact?.phone);
  if (!toNumber) return NextResponse.json({ error: "Contact has no valid phone number on file" }, { status: 400 });

  const client = getTwilioClient()!;
  const sentBy = user.email!.split("@")[0];

  try {
    const msg = await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: toNumber,
      body,
    });

    await db.from("messages").insert({
      contact_id: contactId,
      direction: "outbound",
      from_number: process.env.TWILIO_PHONE_NUMBER,
      to_number: toNumber,
      body,
      status: msg.status,
      twilio_sid: msg.sid,
      sent_by: sentBy,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send failed" }, { status: 500 });
  }
}
