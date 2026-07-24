import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

// Fires once a voicemail recording is ready. Attaches it to the call row
// created when the call first came in.
export async function POST(req: Request) {
  const form = await req.formData();
  const callSid = form.get("CallSid")?.toString() || null;
  const recordingUrl = form.get("RecordingUrl")?.toString() || null;

  if (callSid && recordingUrl) {
    const db = createAdminClient();
    await db.from("calls").update({
      recording_url: `${recordingUrl}.mp3`,
      is_voicemail: true,
      status: "voicemail",
    }).eq("twilio_sid", callSid);
  }

  return new NextResponse(null, { status: 204 });
}
