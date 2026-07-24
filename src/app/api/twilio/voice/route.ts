import { NextResponse } from "next/server";
import Twilio from "twilio";
import { createAdminClient } from "@/lib/supabase-server";
import { findContactIdByPhone } from "@/lib/twilio";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

// Twilio hits this on every incoming call to the business number. Rings
// both Ryan and Leif's browser clients (whoever has the Phone tab open)
// simultaneously; falls through to voicemail if neither picks up.
export async function POST(req: Request) {
  const form = await req.formData();
  const from = form.get("From")?.toString() || null;
  const to = form.get("To")?.toString() || null;
  const callSid = form.get("CallSid")?.toString() || null;

  const db = createAdminClient();
  const contactId = await findContactIdByPhone(from);

  if (callSid) {
    await db.from("calls").insert({
      contact_id: contactId,
      direction: "inbound",
      from_number: from,
      to_number: to,
      status: "ringing",
      twilio_sid: callSid,
    });
  }

  const twiml = new Twilio.twiml.VoiceResponse();
  const dial = twiml.dial({
    timeout: 20,
    action: `${SITE_URL}/api/twilio/voice-status`,
    method: "POST",
  });
  dial.client("ryan");
  dial.client("leif");

  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
