import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { parseReplyAddress, verifyResendWebhook } from "@/lib/replyCapture";

export const maxDuration = 30;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Resend Inbound → email.received (see lib/replyCapture.ts for setup). Logs
// the reply on the contact, stops their sequence, and forwards it to Ryan or
// Leif with Reply-To set to the realtor so answering from Gmail just works.
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Reply capture is not configured" }, { status: 503 });

  const raw = await req.text();
  if (!verifyResendWebhook(raw, req.headers, secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const event = JSON.parse(raw);
  if (event?.type !== "email.received") return NextResponse.json({ ignored: true });
  const data = event.data || {};
  const emailId: string | undefined = data.email_id;
  if (!emailId) return NextResponse.json({ ignored: true });

  const db = createAdminClient();
  const { data: already } = await db.from("email_replies").select("id").eq("resend_email_id", emailId).maybeSingle();
  if (already) return NextResponse.json({ ok: true, duplicate: true }); // Resend retry

  const target = [...(data.to || []), ...(data.cc || []), ...(data.received_for || [])]
    .map((a: string) => parseReplyAddress(a))
    .find(Boolean) || null;
  const forwardTo = target?.adminEmail || "ryan@luckimages.com";

  // Body + display name aren't in the webhook payload.
  const full = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);

  const fromEmail: string = (data.from || full?.from || "").trim();
  const fromHeader: string = full?.headers?.from || "";
  const fromName = fromHeader.includes("<") ? fromHeader.split("<")[0].trim().replace(/^"|"$/g, "") : "";
  const subject: string = data.subject || full?.subject || "(no subject)";
  const text: string = full?.text || (full?.html ? String(full.html).replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

  // Whoever actually wrote it wins (a Cc'd teammate replying); otherwise the
  // contact the reply address was issued for.
  let contactId: string | null = null;
  if (fromEmail) {
    const { data: byEmail } = await db.from("contacts").select("id").ilike("email", escapeLike(fromEmail)).neq("stage", "deleted").limit(1);
    contactId = byEmail?.[0]?.id ?? null;
  }
  if (!contactId && target) {
    const { data: byAddress } = await db.from("contacts").select("id").eq("id", target.contactId).maybeSingle();
    contactId = byAddress?.id ?? null;
  }

  const { error: insertError } = await db.from("email_replies").insert({
    resend_email_id: emailId,
    contact_id: contactId,
    forwarded_to: forwardTo,
    from_email: fromEmail || null,
    from_name: fromName || null,
    subject,
    body_text: text.slice(0, 20000),
    received_at: data.created_at || new Date().toISOString(),
  });
  if (insertError?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
  if (insertError) console.error("resend-inbound: insert failed", insertError);

  if (contactId) {
    await db.from("sequence_enrollments")
      .update({ status: "stopped", stopped_reason: "replied", next_run_on: null })
      .eq("contact_id", contactId).eq("status", "active");
  }

  const attachmentCount = Array.isArray(data.attachments) ? data.attachments.length : 0;
  const banner = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#555;background:#f4f4f5;border:1px solid #e4e4e7;padding:10px 12px;margin-bottom:16px;">
    Reply from <strong>${escapeHtml(fromName || fromEmail)}</strong> &lt;${escapeHtml(fromEmail)}&gt; — logged in Nocturne${contactId ? "" : " (no matching contact)"}.
    Hit Reply to answer them directly.${attachmentCount ? ` This reply had ${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"}, which aren't included here — ask them to resend to your address if you need ${attachmentCount === 1 ? "it" : "them"}.` : ""}
  </div>`;
  const forwardRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${(fromName || fromEmail || "Reply").replace(/[<>"]/g, "")} via Nocturne <replies@luckimages.com>`,
      to: [forwardTo],
      reply_to: fromEmail || undefined,
      subject,
      html: `${banner}${full?.html || `<pre style="font-family:inherit;white-space:pre-wrap;">${escapeHtml(text)}</pre>`}`,
    }),
  });
  if (!forwardRes.ok) {
    console.error("resend-inbound: forward failed", forwardRes.status, await forwardRes.text());
    // Don't let a reply vanish silently.
    await db.from("company_updates").insert({
      message: `📩 Reply from ${fromName || fromEmail} ("${subject}") couldn't be forwarded to ${forwardTo} — it's logged on their contact in Nocturne.`,
      created_by: "system",
      category: "clients",
      link: contactId ? `/admin/contacts/${contactId}` : null,
    });
  }

  return NextResponse.json({ ok: true });
}
