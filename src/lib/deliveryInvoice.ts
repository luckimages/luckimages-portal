import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getTwilioClient, isTwilioConfigured, toE164 } from "./twilio";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Fired the moment a photographer confirms delivery. Auto-creates the
// invoice for the shoot (if one doesn't already exist and a price is set)
// and emails the client one link to their media and one to pay.
export async function createDeliveryInvoiceAndNotify(shootId: string): Promise<void> {
  const db = service();

  const { data: shoot } = await db
    .from("shoots")
    .select("id, address, price, contact_id, client_id")
    .eq("id", shootId)
    .single();
  if (!shoot) return;

  if (!shoot.price || shoot.price <= 0) {
    await db.from("company_updates").insert({
      message: `⚠️ ${shoot.address} delivered with no price set — invoice not created. Add a price on the shoot, then create an invoice manually.`,
      created_by: "system",
      category: "alerts",
      link: "/dashboard/board",
    });
    return;
  }

  // Idempotency — don't double-invoice if this fires more than once for the same shoot.
  const { data: existing } = await db.from("invoices").select("id").eq("shoot_id", shootId).limit(1);
  if (existing && existing.length > 0) return;

  const amountCents = Math.round(shoot.price * 100);

  const { data: invoice, error } = await db.from("invoices").insert({
    shoot_id: shoot.id,
    client_id: shoot.client_id || null,
    contact_id: shoot.contact_id || null,
    amount_cents: amountCents,
    description: `Luck Images — ${shoot.address}`,
    paid: false,
  }).select().single();
  if (error || !invoice) return;

  // Resolve client name/email/phone (contact first, else auth user) + registration state
  let clientName = "there";
  let clientEmail: string | undefined;
  let clientPhone: string | null = null;
  let isRegistered = !!shoot.client_id;
  if (shoot.contact_id) {
    const { data: c } = await db.from("contacts").select("name, email, phone, user_id").eq("id", shoot.contact_id).single();
    if (c) {
      clientName = c.name?.split(" ")[0] || clientName;
      clientEmail = c.email || undefined;
      clientPhone = c.phone;
      if (c.user_id) isRegistered = true;
    }
  }
  if (!clientEmail && shoot.client_id) {
    const { data: { user: cu } } = await db.auth.admin.getUserById(shoot.client_id);
    if (cu) { clientEmail = cu.email || undefined; clientName = cu.user_metadata?.full_name?.split(" ")[0] || clientName; }
  }

  const galleryUrl = isRegistered
    ? `${SITE_URL}/login?redirect=/client/gallery/${shoot.id}`
    : `${SITE_URL}/register`;
  const invoiceUrl = isRegistered
    ? `${SITE_URL}/login?redirect=/client?tab=invoices`
    : `${SITE_URL}/register`;
  const amountStr = `$${(amountCents / 100).toLocaleString()}`;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && clientEmail) {
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;"><tr><td align="center" style="padding:44px 24px;">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <tr><td style="padding-bottom:24px;text-align:center;">
            <img src="https://www.luckimages.com/logo.png" width="48" height="48" alt="Luck Images" style="display:block;margin:0 auto 10px;border:0;" />
            <p style="margin:0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#4ade80;">Media Delivered</p>
          </td></tr>
          <tr><td style="border:1px solid rgba(255,255,255,0.1);padding:34px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;color:#fff;">Your Photos Are Ready, ${clientName}</h1>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#888;">${shoot.address}</p>
            <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#888;">Your media is uploaded and ready to view. An invoice for ${amountStr} is also ready — pay it any time in your portal.</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td>
              <a href="${galleryUrl}" style="display:inline-block;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;text-decoration:none;">View Your Media →</a>
            </td></tr></table>
            <table cellpadding="0" cellspacing="0"><tr><td>
              <a href="${invoiceUrl}" style="display:inline-block;border:1px solid rgba(255,255,255,0.3);color:#fff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;text-decoration:none;">Pay Invoice — ${amountStr} →</a>
            </td></tr></table>
            <p style="margin:28px 0 0;font-size:12px;color:#555;line-height:1.6;">Both links are also waiting in your Luck Images portal.</p>
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
        subject: `${clientName}, your photos are ready — ${shoot.address}`,
        html,
      }),
    });
  }

  const toNumber = toE164(clientPhone);
  if (isTwilioConfigured() && toNumber) {
    try {
      const client = getTwilioClient()!;
      const msg = await client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: toNumber,
        body: `Hi ${clientName}, your photos from ${shoot.address} are ready! View them here: ${galleryUrl}`,
      });
      await db.from("messages").insert({
        contact_id: shoot.contact_id || null,
        direction: "outbound",
        from_number: process.env.TWILIO_PHONE_NUMBER,
        to_number: toNumber,
        body: msg.body,
        status: msg.status,
        twilio_sid: msg.sid,
        sent_by: "system",
      });
    } catch (e) { console.error("delivery text failed", e); }
  }

  await db.from("company_updates").insert({
    message: `📦 Media delivered & invoice sent — ${shoot.address} · ${amountStr}`,
    created_by: "system",
    category: "shoots",
    link: "/dashboard/board",
  });
}
