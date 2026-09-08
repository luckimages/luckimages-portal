import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/supabase-server";
import { resolveClientContact } from "@/lib/shootConfirmation";
import { CLIENT_EMAILS_ENABLED } from "@/lib/constants";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function whenStr(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });
}

function rescheduleEmailHtml(clientName: string, address: string, origStr: string | null, propStr: string, note: string | null) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fff;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;"><tr><td align="center" style="padding:44px 24px;">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr><td style="padding-bottom:24px;text-align:center;">
          <img src="https://www.luckimages.com/logo.png" width="48" height="48" alt="Luck Images" style="display:block;margin:0 auto 10px;border:0;" />
          <p style="margin:0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#fbbf24;">Quick Reschedule Ask</p>
        </td></tr>
        <tr><td style="border:1px solid rgba(255,255,255,0.1);padding:34px;text-align:center;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;color:#fff;">Hey ${clientName}, one thing</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#888;">
            ${origStr ? `${origStr} doesn't work on our end for ${address} — could this time work instead?` : `Here's a proposed time for your shoot at ${address}:`}
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;font-size:14px;color:#ccc;border-top:1px solid #1a1a1a;text-align:left;">
            <tr><td style="padding:10px 0;color:#666;width:110px;border-bottom:1px solid #1a1a1a;">Proposed</td><td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#fff;font-weight:700;">${propStr}</td></tr>
            <tr><td style="padding:10px 0;color:#666;">Address</td><td style="padding:10px 0;">${address}</td></tr>
          </table>
          ${note ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#ccc;">"${note}"</p>` : ""}
          <a href="https://www.luckimages.com/client" style="display:inline-block;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;text-decoration:none;">View in Your Portal →</a>
          <p style="margin:24px 0 0;font-size:12px;color:#555;line-height:1.6;">Just reply to this email to confirm, or suggest another time that works better.</p>
          <p style="margin:16px 0 0;font-size:12px;color:#fff;font-weight:700;">Ryan Luck · Luck Images</p>
        </td></tr>
      </table>
    </td></tr></table></body></html>`;
}

// Admin proposes a different time for a pending booking request — a
// "rebuttal" for when the realtor's requested day/time doesn't work.
// Updates the shoot's scheduled_at to the proposed time (still "pending",
// not confirmed) and emails the realtor asking them to confirm or counter.
// Reuses the same locked-in time when Confirm & Notify is eventually clicked.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shootId, proposedTime, message } = await req.json();
  if (!shootId || !proposedTime) {
    return NextResponse.json({ error: "shootId and proposedTime are required" }, { status: 400 });
  }

  const db = service();
  const { data: shoot } = await db.from("shoots").select("id, address, scheduled_at, contact_id, client_id, notes").eq("id", shootId).single();
  if (!shoot) return NextResponse.json({ error: "Shoot not found" }, { status: 404 });

  const originalTime = shoot.scheduled_at;

  // Stash "originally requested vs. now proposed" so the realtor portal can
  // show both — no dedicated column for this, so it's a leading
  // "[REBUTTAL:<original>|<proposed>]" line in notes (pipe-delimited since
  // ISO timestamps contain colons themselves; client/page.tsx and
  // admin/shoots/page.tsx both strip it before displaying/editing notes).
  // If a rebuttal was already pending, keep the TRUE original rather than
  // overwriting it with the last-proposed time.
  const existingNotes = shoot.notes || "";
  const existingMatch = existingNotes.match(/^\[REBUTTAL:([^|]+)\|([^\]]+)\]\n?([\s\S]*)$/);
  const trueOriginal = existingMatch ? existingMatch[1] : originalTime;
  const restOfNotes = existingMatch ? existingMatch[3] : existingNotes;
  const newNotes = trueOriginal
    ? `[REBUTTAL:${trueOriginal}|${proposedTime}]${restOfNotes ? `\n${restOfNotes}` : ""}`
    : restOfNotes; // no prior time on file to contrast against — skip the marker

  const { error: updErr } = await db.from("shoots").update({ scheduled_at: proposedTime, notes: newNotes }).eq("id", shootId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const { clientFirstName, clientEmail } = await resolveClientContact(shoot.contact_id, shoot.client_id);

  let emailed = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (CLIENT_EMAILS_ENABLED && resendKey && clientEmail) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Ryan Luck <ryan@luckimages.com>",
          to: [clientEmail],
          subject: `Quick reschedule ask — ${shoot.address}`,
          html: rescheduleEmailHtml(
            clientFirstName,
            shoot.address,
            // Always contrast against what the realtor actually asked for,
            // not our own last counter-proposal.
            trueOriginal ? whenStr(trueOriginal) : null,
            whenStr(proposedTime),
            message || null
          ),
        }),
      });
      emailed = res.ok;
      if (!res.ok) console.error("reschedule-request: Resend error", await res.text());
    } catch (e) {
      console.error("reschedule-request: email failed", e);
    }
  }

  await db.from("company_updates").insert({
    message: `↔️ Proposed a new time for ${shoot.address} — ${whenStr(proposedTime)}${emailed ? "" : " (not emailed — client emails are off or no address on file)"}`,
    created_by: admin.email?.split("@")[0] || "admin",
    category: "shoots",
    link: "/dashboard/updates",
  });

  return NextResponse.json({ ok: true, emailed, clientEmail: clientEmail || null });
}
