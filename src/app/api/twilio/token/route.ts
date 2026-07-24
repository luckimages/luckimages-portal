import { NextResponse } from "next/server";
import Twilio from "twilio";
import { requireAdmin } from "@/lib/supabase-server";
import { isTwilioVoiceConfigured } from "@/lib/twilio";

// Voice SDK access token so the browser can register as a "Client" Twilio
// can <Dial> into — this is what makes calls ring inside Nocturne itself.
// Identity = "ryan" or "leif", derived from the logged-in admin's email, so
// TwiML can target either or both of them by name.
export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isTwilioVoiceConfigured()) {
    return NextResponse.json({ error: "Twilio Voice isn't configured yet" }, { status: 503 });
  }

  const identity = user.email!.split("@")[0];

  const AccessToken = Twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_API_KEY!,
    process.env.TWILIO_API_SECRET!,
    { identity, ttl: 3600 }
  );

  token.addGrant(new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!,
    incomingAllow: true,
  }));

  return NextResponse.json({ token: token.toJwt(), identity });
}
