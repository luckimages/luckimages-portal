import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId, to, subject, body, html } = await req.json();

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Log the email
  await service.from("email_log").insert({
    contact_id: contactId,
    subject,
    body,
    sent_by: user.email?.split("@")[0] || "ryan",
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
