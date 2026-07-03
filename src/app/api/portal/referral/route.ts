import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const { referrerName, referrerEmail, friendName, friendEmail } = await request.json();

  if (!friendName || !friendEmail) {
    return NextResponse.json({ error: "Missing friend name or email" }, { status: 400 });
  }

  const res = await fetch("https://api.resend.com/emails", {
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
        `Referred by: ${referrerName} (${referrerEmail})`,
        `Friend's name: ${friendName}`,
        `Friend's email: ${friendEmail}`,
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
