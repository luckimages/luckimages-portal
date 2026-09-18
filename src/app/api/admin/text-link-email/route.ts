import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

// Relays the Cold Call tool's "Follow-up Text" link to the admin's own inbox
// — for whoever's cold-calling without iMessage/Continuity on their computer
// (no way to paste a Mac clipboard straight into their phone's texting app),
// they can instead open this email on their phone, copy the link, and paste
// it into a text. Not a marketing send: no unsubscribe footer, no email_log
// row, no Do Not Contact check — it's an internal utility message to self.
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
      to: [admin.email],
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
