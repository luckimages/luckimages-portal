import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getTwilioClient, isTwilioConfigured, toE164 } from "./twilio";
import { GOOGLE_REVIEW_URL } from "./constants";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Texts clients ~2 days after delivery asking for a Google review. Meant to
// be called once a day (piggybacks on the existing advance-status cron
// rather than a dedicated Vercel Cron slot). A 1.5-2.5 day window means a
// once-a-day call won't skip anyone; review_text_sent_at guards against
// double-sending if called more than once in that window.
export async function sendReviewRequestTexts(): Promise<{ sent: number } | { skipped: string }> {
  if (!isTwilioConfigured()) return { skipped: "Twilio not configured" };

  const db = service();
  const now = Date.now();
  const windowStart = new Date(now - 60 * 60 * 60 * 1000).toISOString(); // 2.5 days ago
  const windowEnd = new Date(now - 36 * 60 * 60 * 1000).toISOString(); // 1.5 days ago

  const { data: shoots, error } = await db
    .from("shoots")
    .select("id, address, contact_id, delivered_at")
    .not("delivered_at", "is", null)
    .is("review_text_sent_at", null)
    .gte("delivered_at", windowStart)
    .lte("delivered_at", windowEnd);

  if (error) {
    // review_text_sent_at column may not exist yet if the migration hasn't run.
    return { skipped: error.message?.includes("review_text_sent_at") ? "Migration not run yet" : error.message };
  }

  const client = getTwilioClient()!;
  let sent = 0;

  for (const shoot of shoots || []) {
    if (!shoot.contact_id) continue;
    const { data: contact } = await db.from("contacts").select("name, phone").eq("id", shoot.contact_id).single();
    const toNumber = toE164(contact?.phone);
    if (!toNumber) continue;

    const firstName = contact?.name?.split(" ")[0] || "there";
    try {
      const msg = await client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: toNumber,
        body: `Hi ${firstName}, loved working with you on ${shoot.address}! Mind leaving a quick Google review? ${GOOGLE_REVIEW_URL}`,
      });
      await db.from("messages").insert({
        contact_id: shoot.contact_id,
        direction: "outbound",
        from_number: process.env.TWILIO_PHONE_NUMBER,
        to_number: toNumber,
        body: msg.body,
        status: msg.status,
        twilio_sid: msg.sid,
        sent_by: "system",
      });
      await db.from("shoots").update({ review_text_sent_at: new Date().toISOString() }).eq("id", shoot.id);
      sent++;
    } catch (e) {
      console.error("review text failed", shoot.id, e);
    }
  }

  return { sent };
}
