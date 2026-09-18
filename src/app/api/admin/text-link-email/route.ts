import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

// Leif doesn't have iMessage/Continuity on his laptop, so a link copied to
// his clipboard can't be pasted straight into a text — this relays the Cold
// Call tool's "Follow-up Text" link to his own inbox instead, so he can open
// it on his phone, copy it, and paste it into iMessage. Hardcoded to his
// address rather than "whoever's logged in" since that's the actual, fixed
// requirement — not a general per-admin utility. Not a marketing send: no
// unsubscribe footer, no email_log row, no Do Not Contact check.
const RECIPIENT = "leif@luckimages.com";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { link, contactName } = await req.json();
  if (!link) return NextResponse.json({ error: "link is required" }, { status: 400 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });

  const subject = contactName ? `Follow-up text link — ${contactName}` : "Follow-up text link";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Luck Images <ryan@luckimages.com>",
      to: [RECIPIENT],
      subject,
      html: `<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;padding:24px;color:#111;">
        <p style="margin:0 0 12px;font-size:14px;">${contactName ? `Text link for <strong>${contactName}</strong>:` : "Text link:"}</p>
        <p style="margin:0;font-size:15px;word-break:break-all;"><a href="${link}">${link}</a></p>
        <p style="margin:20px 0 0;font-size:12px;color:#888;">Copy this and paste it into your texting app.</p>
      </div>`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: `Resend API error (${res.status}): ${errText}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
