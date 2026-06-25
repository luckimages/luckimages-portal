import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://luckimages-portal.vercel.app";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contactId } = await req.json();
  if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: contact } = await service.from("contacts").select("id, name, email").eq("id", contactId).single();
  if (!contact?.email) return NextResponse.json({ error: "Contact has no email" }, { status: 400 });

  const redirectTo = `${SITE_URL}/auth/link-contact?contact_id=${contactId}`;

  // Generate a signup/magic link
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: contact.email,
    options: {
      redirectTo,
      data: { full_name: contact.name },
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkError?.message || "Failed to generate link" }, { status: 500 });
  }

  const inviteLink = linkData.properties.action_link;
  const firstName = contact.name.split(" ")[0];

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;min-height:100vh;">
    <tr><td align="center" style="padding:48px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding-bottom:32px;">
          <p style="margin:0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#444;">Luck Images</p>
        </td></tr>
        <tr><td style="border:1px solid rgba(255,255,255,0.1);padding:40px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:900;letter-spacing:-0.5px;text-transform:uppercase;color:#fff;">
            You're Invited, ${firstName}
          </h1>
          <p style="margin:0 0 28px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#555;">Client Portal Access</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#888;">
            Hi ${firstName}, I wanted to personally invite you to the Luck Images client portal — your hub for all shoots, invoices, and media deliveries.
          </p>
          <p style="margin:0 0 32px;font-size:14px;line-height:1.6;color:#888;">
            Click below to set up your account. The link is valid for 24 hours.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${inviteLink}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:14px 32px;">
              Access Your Portal →
            </a>
          </td></tr></table>
          <p style="margin:28px 0 0;font-size:11px;color:#333;line-height:1.6;">
            Or copy this link:<br>
            <span style="color:#555;word-break:break-all;">${inviteLink}</span>
          </p>
        </td></tr>
        <tr><td style="padding-top:24px;">
          <p style="margin:0;font-size:11px;color:#333;letter-spacing:1px;">
            Ryan Luck — Luck Images · Austin, TX · ryan@luckimages.com
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Ryan Luck <ryan@luckimages.com>",
        to: [contact.email],
        subject: `${firstName}, your Luck Images portal is ready`,
        html,
      }),
    });
    if (!emailRes.ok) {
      return NextResponse.json({ error: "Email send failed" }, { status: 500 });
    }
  }

  // Log in email_log
  await service.from("email_log").insert({
    contact_id: contactId,
    subject: `${firstName}, your Luck Images portal is ready`,
    body: `Portal invite sent to ${contact.email}`,
    sent_by: user.email?.split("@")[0] || "ryan",
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
