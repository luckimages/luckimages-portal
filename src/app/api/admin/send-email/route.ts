import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { adminSender, SENDER_NAME_TOKEN, SENDER_EMAIL_TOKEN } from "@/lib/constants";
import { registerLinkDomainsFromContent } from "@/lib/trustedLinkDomains";
import { replyToAddress } from "@/lib/replyCapture";
import {
  addUnsubscribeFooterHtml, addUnsubscribeFooterText, blockedContactIds,
  listUnsubscribeHeaders, marketingEmailStatus, unsubscribePageUrl,
} from "@/lib/unsubscribe";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contactId, to, subject, body, html, category, cc, additionalContactIds } = await req.json();

  const service = createAdminClient();

  // Send via Resend if configured
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY is not configured" }, { status: 500 });
  }

  // Every send through here is marketing/outreach (Outreach templates, Quick
  // Send, Mass Invite, cold-call pitches), so it honors unsubscribe and Do Not
  // Contact. Booking, delivery, and invoice emails don't come through here.
  const status = await marketingEmailStatus(service, { contactId, email: to });
  if (status.blocked) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: status.blocked,
      error: status.blocked === "do_not_contact" ? "Skipped — marked Do Not Contact" : "Skipped — unsubscribed from emails",
    }, { status: 409 });
  }

  // Group sends: quietly drop any Cc'd contact who's opted out.
  let ccList: string[] = Array.isArray(cc) ? cc : [];
  let extraContactIds: string[] = Array.isArray(additionalContactIds) ? additionalContactIds : [];
  let skippedCc = 0;
  if (extraContactIds.length > 0) {
    const blocked = await blockedContactIds(service, extraContactIds);
    if (blocked.size > 0) {
      const { data: blockedRows } = await service.from("contacts").select("email").in("id", [...blocked]);
      const blockedEmails = new Set((blockedRows || []).map(r => (r.email || "").toLowerCase()));
      const before = ccList.length;
      ccList = ccList.filter(e => !blockedEmails.has((e || "").toLowerCase()));
      skippedCc = before - ccList.length;
      extraContactIds = extraContactIds.filter(id => !blocked.has(id));
    }
  }

  // One recipient → their personal one-click link. A shared group message
  // can't know who clicked, so it links to the ask-for-your-email page.
  const isGroup = ccList.length > 0;
  const unsubscribeUrl = unsubscribePageUrl(isGroup ? null : status.token);

  // Send as the admin who clicked send (Leif from his portal → leif@…)
  const sender = adminSender(admin.email);

  // Swap the signature token for the actual sender's name so the sign-off
  // matches the From address.
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(esc(SENDER_NAME_TOKEN), "g");
  const emailRe = new RegExp(esc(SENDER_EMAIL_TOKEN), "g");
  const fillTokens = (s: string) => s.replace(nameRe, sender.fullName).replace(emailRe, sender.replyTo);
  const finalHtml = typeof html === "string" ? addUnsubscribeFooterHtml(fillTokens(html), unsubscribeUrl) : html;
  const finalBody = typeof body === "string" ? fillTokens(body) : body;
  const sentText = typeof finalBody === "string" ? addUnsubscribeFooterText(finalBody, unsubscribeUrl) : finalBody;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: sender.from,
      // Reply capture (when switched on) logs their reply on the contact and
      // forwards it to this admin's inbox; otherwise replies go straight there.
      reply_to: replyToAddress(admin.email, contactId) || sender.replyTo,
      to: [to],
      ...(ccList.length > 0 ? { cc: ccList } : {}),
      subject,
      ...(finalHtml ? { html: finalHtml } : { text: sentText }),
      ...(!isGroup && status.token ? { headers: listUnsubscribeHeaders(status.token) } : {}),
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    return NextResponse.json({ ok: false, error: `Resend API error (${resendRes.status}): ${errText}` }, { status: 502 });
  }

  // This Quick Send just went out with an admin's approval — any track-link
  // ?url= destinations embedded in it are now trusted for the public
  // redirect to honor. Never done from the public side, only here.
  try { await registerLinkDomainsFromContent(service, finalHtml || finalBody || ""); }
  catch (e) { console.error("send-email: registerLinkDomainsFromContent failed", e); }

  // Only log — and therefore only show as "emailed" in Engagement — once
  // Resend has actually confirmed the send. Logging before this point meant
  // a missing API key or a Resend-side failure still showed as sent.
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
  if (extraContactIds.length > 0) {
    await service.from("email_log").insert(
      extraContactIds.map((id: string) => ({
        contact_id: id,
        subject,
        body,
        category: category || null,
        sent_by: admin.email?.split("@")[0] || "ryan",
      }))
    );
  }

  return NextResponse.json({ ok: true, skippedCc });
}
