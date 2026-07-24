import { NextResponse } from "next/server";
import Twilio from "twilio";

// TwiML App's Voice Request URL — hit whenever Ryan or Leif clicks "Call"
// from the browser dialer (Device.connect()). Bridges their browser leg out
// to the real PSTN number, caller ID'd as the business line.
export async function POST(req: Request) {
  const form = await req.formData();
  const to = form.get("To")?.toString();

  const twiml = new Twilio.twiml.VoiceResponse();
  if (to) {
    twiml.dial({ callerId: process.env.TWILIO_PHONE_NUMBER }).number(to);
  } else {
    twiml.say("No destination number provided.");
  }

  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
