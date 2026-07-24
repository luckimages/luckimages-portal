import { NextResponse } from "next/server";
import { requireAdmin, createAdminClient } from "@/lib/supabase-server";

// Logs the browser-dialer side of calls — the Voice SDK Device fires these
// events client-side (there's no server webhook for a Client -> PSTN call
// the way there is for inbound Dial). "started" happens on outgoing
// Device.connect(); "accepted" fires for both directions once someone
// actually answers; "ended" fires on disconnect.
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { callSid, event, contactId, toNumber, durationSeconds } = await req.json();
  if (!callSid || !event) return NextResponse.json({ error: "callSid and event required" }, { status: 400 });

  const db = createAdminClient();
  const identity = user.email!.split("@")[0];

  if (event === "started") {
    await db.from("calls").insert({
      contact_id: contactId || null,
      direction: "outbound",
      to_number: toNumber || null,
      status: "ringing",
      twilio_sid: callSid,
      answered_by: identity,
    });
  } else if (event === "accepted") {
    await db.from("calls").update({ status: "completed", answered_by: identity }).eq("twilio_sid", callSid);
  } else if (event === "ended") {
    await db.from("calls").update({
      status: "completed",
      duration_seconds: typeof durationSeconds === "number" ? durationSeconds : null,
    }).eq("twilio_sid", callSid);
  }

  return NextResponse.json({ ok: true });
}
