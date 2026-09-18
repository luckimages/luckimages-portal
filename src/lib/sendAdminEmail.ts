import { SupabaseClient } from "@supabase/supabase-js";
import { adminSender, SENDER_NAME_TOKEN, SENDER_EMAIL_TOKEN } from "@/lib/constants";
import { registerLinkDomainsFromContent } from "@/lib/trustedLinkDomains";
import { replyToAddress } from "@/lib/replyCapture";
import {
  addUnsubscribeFooterHtml, addUnsubscribeFooterText, blockedContactIds,
  listUnsubscribeHeaders, marketingEmailStatus, unsubscribePageUrl,
} from "@/lib/unsubscribe";

export type SendAdminEmailParams = {
  contactId?: string | null;
  to: string;
  subject: string;
  body?: string;
  html?: string;
  category?: string | null;
  cc?: string[];
  additionalContactIds?: string[];
};

export type SendAdminEmailResult =
  | { ok: true; status: 200; skippedCc: number }
  | { ok: false; status: number; error: string; skipped?: boolean; reason?: string };

// Core of /api/admin/send-email, shared with any other admin-authored send
// (e.g. the single-contact portal invite) so every path honors unsubscribe /
// Do Not Contact, resolves the sender the same way, and logs identically —
// "same email, different place to send it from" shouldn't mean a second,
// drifting implementation.
export async function sendAdminEmail(
  service: SupabaseClient,
  admin: { email?: string | null },
  params: SendAdminEmailParams
): Promise<SendAdminEmailResult> {
  const { contactId, to, subject, body, html, category, additionalContactIds } = params;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { ok: false, status: 500, error: "RESEND_API_KEY is not configured" };
  }

  const status = await marketingEmailStatus(service, { contactId, email: to });
  if (status.blocked) {
    return {
      ok: false,
      status: 409,
      skipped: true,
      reason: status.blocked,
      error: status.blocked === "do_not_contact" ? "Skipped — marked Do Not Contact" : "Skipped — unsubscribed from emails",
    };
  }

  let ccList: string[] = Array.isArray(params.cc) ? params.cc : [];
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

  const isGroup = ccList.length > 0;
  const unsubscribeUrl = unsubscribePageUrl(isGroup ? null : status.token);

  const sender = adminSender(admin.email);

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
    return { ok: false, status: 502, error: `Resend API error (${resendRes.status}): ${errText}` };
  }

  try { await registerLinkDomainsFromContent(service, finalHtml || finalBody || ""); }
  catch (e) { console.error("sendAdminEmail: registerLinkDomainsFromContent failed", e); }

  await service.from("email_log").insert({
    contact_id: contactId,
    subject,
    body,
    category: category || null,
    sent_by: admin.email?.split("@")[0] || "ryan",
  });

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

  return { ok: true, status: 200, skippedCc };
}
