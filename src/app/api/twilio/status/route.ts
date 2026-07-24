import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";
import { isTwilioConfigured, isTwilioVoiceConfigured } from "@/lib/twilio";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    smsConfigured: isTwilioConfigured(),
    voiceConfigured: isTwilioVoiceConfigured(),
    phoneNumber: isTwilioConfigured() ? process.env.TWILIO_PHONE_NUMBER : null,
  });
}
