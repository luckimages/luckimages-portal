// Sent when a realtor shares one of their invoices with a third party (an
// accountant, the homeowner, a broker, etc.) who needs to pay it but has no
// portal login. Same hero-image background + dark card as the Mass Invite /
// delivery-notification emails (src/lib/portalInviteEmail.ts,
// src/lib/deliveryInvoice.ts) — kept in sync by eye since the templates don't
// share a component.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

export type ShareInvoiceInput = {
  recipientName: string;
  realtorName: string;
  address: string;
  services: string[];
  amountCents: number;
  invoiceId: string;
};

export function buildShareInvoiceEmail(input: ShareInvoiceInput) {
  const firstName = input.recipientName.trim().split(" ")[0] || "there";
  const amountStr = `$${(input.amountCents / 100).toLocaleString()}`;
  const invoiceUrl = `${SITE_URL}/invoice/${input.invoiceId}`;
  const servicesStr = input.services.length > 0 ? input.services.join(", ") : "Real Estate Media";

  const subject = `Invoice for ${input.address} — shared by ${input.realtorName}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" background="${SITE_URL}/hero-1.jpg" style="background-color:#0c0c0c;background-image:linear-gradient(rgba(12,12,12,0.72),rgba(12,12,12,0.72)),url('${SITE_URL}/hero-1.jpg');background-size:cover;background-position:center;">
    <tr><td align="center" style="padding:48px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="border:1px solid rgba(255,255,255,0.15);padding:40px;background:rgba(12,12,12,0.55);">
          <div style="text-align:center;padding-bottom:24px;">
            <img src="${SITE_URL}/logo.png" width="48" height="48" alt="Luck Images" style="display:block;margin:0 auto 10px;border:0;" />
            <p style="margin:0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#fbbf24;">Invoice Shared With You</p>
          </div>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;color:#fff;">Hey ${firstName},</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#ccc;">
            <strong style="color:#fff;">${input.realtorName}</strong> shared a Luck Images invoice with you to take care of on their behalf.
          </p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#ccc;">
            No account or login needed — just tap the button below to see the full breakdown and pay it securely online.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);margin:0 0 28px;">
            <tr><td style="padding:18px 20px;">
              <p style="margin:0 0 4px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#666;">Property</p>
              <p style="margin:0 0 14px;font-size:14px;color:#fff;">${input.address}</p>
              <p style="margin:0 0 4px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#666;">Services</p>
              <p style="margin:0 0 14px;font-size:14px;color:#fff;">${servicesStr}</p>
              <p style="margin:0 0 4px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#666;">Amount Due</p>
              <p style="margin:0;font-size:20px;font-weight:900;color:#fbbf24;">${amountStr}</p>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${invoiceUrl}" style="display:inline-block;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:16px 32px;text-decoration:none;">View &amp; Pay Invoice →</a>
          </td></tr></table>
          <p style="margin:28px 0 0;font-size:11px;color:#555;line-height:1.6;">
            Questions about this invoice? Reply to this email or reach out to ${input.realtorName} directly.
          </p>
        </td></tr>
        <tr><td style="padding-top:24px;">
          <p style="margin:0;font-size:11px;color:#fff;letter-spacing:1px;text-shadow:0 1px 3px rgba(0,0,0,0.8);">Ryan Luck — Luck Images · Austin, TX · <a href="mailto:ryan@luckimages.com" style="color:#fff;text-decoration:none;">ryan@luckimages.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, invoiceUrl };
}
