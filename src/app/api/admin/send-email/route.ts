import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId, to, subject, body, html, category } = await req.json();

  const service = createAdminClient();

  // Log the email
  await service.from("email_log").insert({
    contact_id: contactId,
    subject,
    body,
    category: category || null,
    sent_by: admin.email?.split("@")[0] || "ryan",
  });

  // Send via Resend if configured
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY is not configured" }, { status: 500 });
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Ryan Luck <ryan@luckimages.com>",
      to: [to],
      subject,
      ...(html ? { html } : { text: body }),
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    return NextResponse.json({ ok: false, error: `Resend API error (${resendRes.status}): ${errText}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
