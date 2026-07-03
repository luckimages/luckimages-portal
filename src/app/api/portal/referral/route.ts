import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://luckimages.com";

export async function POST(request: NextRequest) {
  const { referrerContactId, referrerName, friendName, friendEmail } = await request.json();

  if (!friendName || !friendEmail || !referrerContactId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Build the tracked referral link — same format the marketing dashboard uses
  const referralLink = `${BASE_URL}/register?ref=${referrerContactId}`;

  // Email the friend with the tracked link
  const friendEmail_ = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Ryan Luck <ryan@luckimages.com>",
      to: [friendEmail],
      reply_to: "ryan@luckimages.com",
      subject: `${referrerName} thinks you'd love Luck Images`,
      text: [
        `Hey ${friendName},`,
        ``,
        `${referrerName} referred you to Luck Images — Austin's go-to real estate media team.`,
        ``,
        `We offer professional listing photos, drone, video, Matterport, virtual staging, and more — delivered within 24 hours.`,
        ``,
        `Create your account and book your first shoot here:`,
        referralLink,
        ``,
        `— Ryan Luck`,
        `Luck Images`,
        `ryan@luckimages.com`,
      ].join("\n"),
    }),
  });

  // Also notify Ryan
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Ryan Luck <ryan@luckimages.com>",
      to: ["ryan@luckimages.com"],
      subject: `New referral from ${referrerName}`,
      text: [
        `Referral submitted through the client portal.`,
        ``,
        `Referred by: ${referrerName} (contact ID: ${referrerContactId})`,
        `Friend: ${friendName} — ${friendEmail}`,
        ``,
        `Referral link sent: ${referralLink}`,
      ].join("\n"),
    }),
  });

  // Log the referral as a contact with referral source attributed
  await db().from("contacts").upsert({
    name: friendName,
    email: friendEmail,
    stage: "lead",
    lead_source: "referral",
    referred_by_contact_id: referrerContactId,
  }, { onConflict: "email" });

  return NextResponse.json({ ok: true });
}
