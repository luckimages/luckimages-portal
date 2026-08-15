import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS, CLIENT_EMAILS_ENABLED } from "@/lib/constants";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

// Admin creates an invoice for a shoot. Derives the client/contact from the
// shoot, stores it, and emails the client a notice to pay in their portal.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shootId, amountCents, description, dueDate } = await req.json();
  if (!shootId || !amountCents || amountCents <= 0) {
    return NextResponse.json({ error: "shootId and a positive amount are required" }, { status: 400 });
  }

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: shoot } = await db.from("shoots").select("id, address, client_id, contact_id").eq("id", shootId).single();
  if (!shoot) return NextResponse.json({ error: "Shoot not found" }, { status: 404 });

  const { data: invoice, error } = await db.from("invoices").insert({
    shoot_id: shoot.id,
    client_id: shoot.client_id || null,
    contact_id: shoot.contact_id || null,
    amount_cents: Math.round(amountCents),
    description: description || `Luck Images — ${shoot.address}`,
    due_date: dueDate || null,
    paid: false,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Resolve client email (contact first, else auth user) and notify them
  let clientEmail: string | undefined;
  let clientName = "there";
  let isRegistered = false;
  if (shoot.contact_id) {
    const { data: c } = await db.from("contacts").select("name, email, user_id").eq("id", shoot.contact_id).single();
    if (c) { clientEmail = c.email || undefined; clientName = c.name?.split(" ")[0] || clientName; isRegistered = !!c.user_id; }
  }
  if (shoot.client_id) isRegistered = true;
  if (!clientEmail && shoot.client_id) {
    const { data: { user: cu } } = await db.auth.admin.getUserById(shoot.client_id);
    if (cu) clientEmail = cu.email || undefined;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (CLIENT_EMAILS_ENABLED && resendKey && clientEmail) {
    const amountStr = `$${(Math.round(amountCents) / 100).toLocaleString()}`;
    const ctaLabel = isRegistered ? "View &amp; Pay in Portal →" : "Create Account &amp; Pay →";
    const ctaHref = isRegistered ? `${SITE_URL}/client?tab=invoices` : `${SITE_URL}/register`;
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;"><tr><td align="center" style="padding:44px 24px;">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <tr><td style="padding-bottom:24px;text-align:center;">
            <img src="https://www.luckimages.com/logo.png" width="48" height="48" alt="Luck Images" style="display:block;margin:0 auto 10px;border:0;" />
            <p style="margin:0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#4ade80;">New Invoice</p>
          </td></tr>
          <tr><td style="border:1px solid rgba(255,255,255,0.1);padding:34px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;color:#fff;">Invoice for ${clientName}</h1>
            <p style="margin:0 0 8px;font-size:14px;color:#888;">${invoice.description}</p>
            <p style="margin:0 0 24px;font-size:34px;font-weight:900;color:#fff;">${amountStr}</p>
            <a href="${ctaHref}" style="display:inline-block;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;text-decoration:none;">${ctaLabel}</a>
            <p style="margin:24px 0 0;font-size:12px;color:#555;line-height:1.6;">Pay securely by card or bank in your Luck Images portal${isRegistered ? "" : " — create your free account to view and pay"}.</p>
            <p style="margin:16px 0 0;font-size:12px;color:#fff;font-weight:700;">Ryan Luck · Luck Images</p>
          </td></tr>
        </table>
      </td></tr></table></body></html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Ryan Luck <ryan@luckimages.com>",
        to: [clientEmail],
        subject: `Your Luck Images invoice — $${(Math.round(amountCents) / 100).toLocaleString()}`,
        html,
      }),
    });
  }

  return NextResponse.json({ ok: true, invoice, emailed: !!clientEmail });
}
