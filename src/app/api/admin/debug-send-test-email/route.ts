import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase-server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com";

// Temporary: sends the exact media-delivery template to the logged-in admin
// with sample data, for a byte-accurate visual preview using the real
// (production) Resend key. Not wired into any real flow — safe to delete
// once the preview has been reviewed.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

  const clientName = "Jules";
  const address = "3915 Barth Road, Caldwell County, TX";
  const amountStr = "$150";
  const invoicePaid = false;
  const galleryUrl = `${SITE_URL}/login?redirect=/client/gallery/10fc9856-34d5-4c19-aa1c-bc89983b34a6`;
  const invoiceUrl = `${SITE_URL}/login?redirect=/client?tab=invoices`;

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
            <p style="margin:0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#4ade80;">Media Delivered</p>
          </div>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;color:#fff;">Your Photos Are Ready, ${clientName}</h1>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#ccc;">${address}</p>
          <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#ccc;">Your media is uploaded and ready to view and download in your portal.${amountStr && !invoicePaid ? ` Pay the ${amountStr} invoice to unlock full-resolution downloads.` : ""}</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr><td>
            <a href="${galleryUrl}" style="display:inline-block;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;text-decoration:none;">View Your Media →</a>
          </td></tr></table>
          ${amountStr && !invoicePaid ? `<table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${invoiceUrl}" style="display:inline-block;border:1px solid rgba(255,255,255,0.4);color:#fff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;text-decoration:none;">Pay Invoice — ${amountStr} →</a>
          </td></tr></table>` : ""}
          <p style="margin:28px 0 0;font-size:12px;color:#999;line-height:1.6;">Everything is waiting in your Luck Images portal.</p>
        </td></tr>
        <tr><td style="padding-top:24px;">
          <p style="margin:0;font-size:11px;color:#fff;letter-spacing:1px;text-shadow:0 1px 3px rgba(0,0,0,0.8);">Ryan Luck &amp; Leif Tilton — Luck Images · Austin, TX · <a href="mailto:ryan@luckimages.com" style="color:#fff;text-decoration:none;">ryan@luckimages.com</a> · <a href="mailto:leif@luckimages.com" style="color:#fff;text-decoration:none;">leif@luckimages.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Ryan Luck <ryan@luckimages.com>",
      to: [admin.email],
      subject: `[TEST] ${clientName}, your photos are ready — ${address}`,
      html,
    }),
  });
  const data = await res.json();
  return NextResponse.json({ ok: res.ok, resend: data });
}
