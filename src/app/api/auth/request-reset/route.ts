import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const SITE_URL = "https://www.luckimages.com";

// Branded reset email — same visual style as the rest of the outreach/booking
// emails — sent via Resend from ryan@luckimages.com, instead of Supabase's
// own default "Supabase Auth" sender/template.
function buildResetHtml(actionLink: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#0c0c0c;font-family:Arial,sans-serif;color:#fff;" bgcolor="#0c0c0c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0c0c;min-height:100vh;" bgcolor="#0c0c0c">
<tr><td align="center" valign="middle" style="background-color:#0c0c0c;padding:40px 20px;" bgcolor="#0c0c0c">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#0c0c0c;" bgcolor="#0c0c0c">
<tr><td align="center" style="text-align:center;">
  <img src="${SITE_URL}/logo.png" width="52" height="52" alt="Luck Images" style="display:block;margin:0 auto 12px;border:0;" />
  <p style="margin:0 0 6px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#cccccc;">Real Estate Media · Austin, TX</p>
  <h1 style="margin:0 0 28px;font-size:32px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;color:#ffffff;line-height:1;">LUCK IMAGES</h1>
  <h2 style="margin:0 0 16px;font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;color:#fff;">Reset Your Password</h2>
  <p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 28px;max-width:400px;">We received a request to reset the password for your Luck Images account. Click below to choose a new one.</p>
  <a href="${actionLink}" style="display:inline-block;background:#ffffff;color:#000000;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;text-decoration:none;margin-bottom:28px;">Reset Password →</a>
  <p style="color:#444;font-size:11px;line-height:1.6;margin:24px 0 0;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email: email.trim(),
    options: { redirectTo: `${SITE_URL}/set-password` },
  });

  // Never reveal whether the address is registered — always return ok,
  // only actually send an email when the lookup succeeds.
  const actionLink = data?.properties?.action_link;
  const resendKey = process.env.RESEND_API_KEY;

  if (!error && actionLink && resendKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Luck Images <ryan@luckimages.com>",
        to: [email.trim()],
        subject: "Reset your Luck Images password",
        html: buildResetHtml(actionLink),
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
