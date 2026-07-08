import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId, to, subject, body, html, category, cc, additionalContactIds } = await req.json();

  const service = createAdminClient();

  // Log the email for the primary (To) recipient
  await service.from("email_log").insert({
    contact_id: contactId,
    subject,
    body,
    category: category || null,
    sent_by: admin.email?.split("@")[0] || "ryan",
  });

  // Grouped sends (one message, multiple Cc'd recipients) still log every
  // other recipient so they all show as "emailed" in Engagement, even though
  // only one message was physically sent and only the primary recipient's
  // link clicks can be attributed.
  if (Array.isArray(additionalContactIds) && additionalContactIds.length > 0) {
    await service.from("email_log").insert(
      additionalContactIds.map((id: string) => ({
        contact_id: id,
        subject,
        body,
        category: category || null,
        sent_by: admin.email?.split("@")[0] || "ryan",
      }))
    );
  }

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
      ...(Array.isArray(cc) && cc.length > 0 ? { cc } : {}),
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
