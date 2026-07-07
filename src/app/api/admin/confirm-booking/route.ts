import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { createShootEvent } from "@/lib/googleCalendar";
import { ADMIN_EMAILS } from "@/lib/constants";

// Admin confirms a pending booking request: locks the time, assigns
// photographer(s), emails the client, creates a calendar invite (Leif +
// client + photographers), and flips the shoot to scheduled.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shootId, scheduledAt, photographerIds } = await req.json();
  if (!shootId) return NextResponse.json({ error: "shootId required" }, { status: 400 });

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: shoot } = await db.from("shoots").select("*").eq("id", shootId).single();
  if (!shoot) return NextResponse.json({ error: "Shoot not found" }, { status: 404 });

  const finalTime = scheduledAt || shoot.scheduled_at;
  const finalPhotographers = photographerIds && photographerIds.length ? photographerIds : shoot.photographer_ids;

  // Update the shoot → confirmed/scheduled
  const { error: updErr } = await db.from("shoots").update({
    status: "scheduled",
    scheduled_at: finalTime,
    photographer_ids: finalPhotographers || null,
    confirmed_at: new Date().toISOString(),
  }).eq("id", shootId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Resolve the client's name + email (contact first, else auth user)
  let clientName = "there";
  let clientEmail: string | undefined;
  if (shoot.contact_id) {
    const { data: c } = await db.from("contacts").select("name, email").eq("id", shoot.contact_id).single();
    if (c) { clientName = c.name?.split(" ")[0] || clientName; clientEmail = c.email || undefined; }
  }
  if (!clientEmail && shoot.client_id) {
    const { data: { user: cu } } = await db.auth.admin.getUserById(shoot.client_id);
    if (cu) { clientEmail = cu.email || undefined; clientName = cu.user_metadata?.full_name?.split(" ")[0] || clientName; }
  }

  // Photographer emails for the calendar invite
  const photographerEmails: string[] = [];
  for (const pid of finalPhotographers || []) {
    const { data: { user: pu } } = await db.auth.admin.getUserById(pid);
    if (pu?.email) photographerEmails.push(pu.email);
  }

  // Calendar event (invites go out via sendUpdates: "all")
  let calendarOk = false;
  try {
    await createShootEvent({
      address: shoot.address,
      scheduledAt: finalTime,
      services: shoot.services || [],
      notes: shoot.notes || undefined,
      clientEmail,
      clientName,
      photographerEmails,
    });
    calendarOk = true;
  } catch (e) {
    console.error("confirm-booking: calendar event failed", e);
  }

  const whenStr = new Date(finalTime).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });
  const svcStr = (shoot.services || []).join(", ") || "your shoot";

  // Confirmation email to the client
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && clientEmail) {
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;"><tr><td align="center" style="padding:44px 24px;">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <tr><td style="padding-bottom:24px;text-align:center;">
            <img src="https://www.luckimages.com/logo.png" width="48" height="48" alt="Luck Images" style="display:block;margin:0 auto 10px;border:0;" />
            <p style="margin:0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#4ade80;">Shoot Confirmed</p>
          </td></tr>
          <tr><td style="border:1px solid rgba(255,255,255,0.1);padding:34px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;color:#fff;">You're all set, ${clientName}</h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#888;">Your shoot is confirmed. A calendar invite is on its way — here are the details:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#ccc;border-top:1px solid #1a1a1a;">
              <tr><td style="padding:10px 0;color:#666;width:110px;border-bottom:1px solid #1a1a1a;">When</td><td style="padding:10px 0;border-bottom:1px solid #1a1a1a;color:#fff;font-weight:700;">${whenStr}</td></tr>
              <tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #1a1a1a;">Address</td><td style="padding:10px 0;border-bottom:1px solid #1a1a1a;">${shoot.address}</td></tr>
              <tr><td style="padding:10px 0;color:#666;">Services</td><td style="padding:10px 0;">${svcStr}</td></tr>
            </table>
            <a href="https://www.luckimages.com/client" style="display:inline-block;margin-top:26px;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;text-decoration:none;">View in Your Portal →</a>
            <p style="margin:24px 0 0;font-size:12px;color:#555;line-height:1.6;">Need to change anything? Just reply to this email.</p>
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
        subject: `Confirmed: your Luck Images shoot — ${whenStr}`,
        html,
      }),
    });
  }

  // Command Center
  await db.from("company_updates").insert({
    message: `✅ Booking confirmed — ${shoot.address} · ${whenStr}`,
    created_by: user.email?.split("@")[0] || "admin",
    category: "shoots",
    link: "/dashboard/board",
  });

  return NextResponse.json({ ok: true, calendarOk, emailed: !!clientEmail });
}
