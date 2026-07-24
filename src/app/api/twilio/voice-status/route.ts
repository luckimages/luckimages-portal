import { NextResponse } from "next/server";
import Twilio from "twilio";
import { createAdminClient } from "@/lib/supabase-server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

// Fires after the simultaneous-ring <Dial> to ryan+leif finishes, one way
// or another. Answered -> just let the call end normally. Unanswered ->
// play a voicemail prompt and record one.
export async function POST(req: Request) {
  const form = await req.formData();
  const callSid = form.get("CallSid")?.toString() || null;
  const dialStatus = form.get("DialCallStatus")?.toString() || null;
  const dialDuration = form.get("DialCallDuration")?.toString();

  // This endpoint is hit twice for an unanswered call — once as the <Dial>
  // action, once again as the <Record> action after the voicemail. Only the
  // first carries DialCallStatus; skip the update on the second so it
  // doesn't blank out the status/duration we just set.
  const db = createAdminClient();
  if (callSid && dialStatus) {
    await db.from("calls").update({
      status: dialStatus === "completed" ? "completed" : "missed",
      duration_seconds: dialDuration ? parseInt(dialDuration, 10) : null,
    }).eq("twilio_sid", callSid);
  }

  const twiml = new Twilio.twiml.VoiceResponse();
  if (dialStatus === "completed") {
    twiml.hangup();
  } else {
    twiml.say("Sorry we missed you. Please leave a message after the tone, and we'll get back to you shortly.");
    twiml.record({
      maxLength: 120,
      recordingStatusCallback: `${SITE_URL}/api/twilio/recording-status`,
      recordingStatusCallbackMethod: "POST",
      action: `${SITE_URL}/api/twilio/voice-status`,
    });
    twiml.hangup();
  }

  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
