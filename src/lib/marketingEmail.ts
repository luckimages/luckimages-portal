import type { SupabaseClient } from "@supabase/supabase-js";
import { adminSender } from "@/lib/constants";
import { replyToAddress } from "@/lib/replyCapture";
import {
  addUnsubscribeFooterHtml, listUnsubscribeHeaders, marketingEmailStatus, unsubscribePageUrl, type EmailBlockReason,
} from "@/lib/unsubscribe";

export type MarketingSendResult = { ok: true } | { ok: false; skipped?: EmailBlockReason | "no_email"; error: string };

// One marketing email to one contact, from a background job (sequences).
// Same rules as /api/admin/send-email: skips unsubscribed / Do Not Contact,
// adds the unsubscribe footer + one-click headers, uses the reply-capture
// Reply-To when that's switched on, and logs to email_log on success.
export async function sendMarketingEmail(
  db: SupabaseClient,
  opts: { senderEmail: string | null; contactId: string; subject: string; html: string; text: string; category: string },
): Promise<MarketingSendResult> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, error: "RESEND_API_KEY is not configured" };

  const { data: contact } = await db.from("contacts").select("email").eq("id", opts.contactId).maybeSingle();
  if (!contact?.email) return { ok: false, skipped: "no_email", error: "Contact has no email" };

  const status = await marketingEmailStatus(db, { contactId: opts.contactId });
  if (status.blocked) return { ok: false, skipped: status.blocked, error: `Skipped — ${status.blocked}` };

  const sender = adminSender(opts.senderEmail);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: sender.from,
      reply_to: replyToAddress(opts.senderEmail, opts.contactId) || sender.replyTo,
      to: [contact.email],
      subject: opts.subject,
      html: addUnsubscribeFooterHtml(opts.html, unsubscribePageUrl(status.token)),
      ...(status.token ? { headers: listUnsubscribeHeaders(status.token) } : {}),
    }),
  });
  if (!res.ok) return { ok: false, error: `Resend API error (${res.status}): ${await res.text()}` };

  await db.from("email_log").insert({
    contact_id: opts.contactId,
    subject: opts.subject,
    body: opts.text,
    category: opts.category,
    sent_by: (opts.senderEmail || "ryan").split("@")[0],
  });
  return { ok: true };
}
