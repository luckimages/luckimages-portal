import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createShootEvent } from "@/lib/googleCalendar";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Resolves the client's name/phone/email for a shoot — contact record first
// (phone-booked/cold-call contacts), falling back to the portal auth user
// (self-service bookings) if no contact is linked or the contact has no email.
export async function resolveClientContact(
  contactId: string | null | undefined,
  clientId: string | null | undefined
): Promise<{ clientFirstName: string; clientFullName: string | undefined; clientEmail: string | undefined; clientPhone: string | undefined }> {
  const db = service();
  let clientFirstName = "there";
  let clientFullName: string | undefined;
  let clientEmail: string | undefined;
  let clientPhone: string | undefined;

  if (contactId) {
    const { data: c } = await db.from("contacts").select("name, email, phone").eq("id", contactId).single();
    if (c) {
      clientFullName = c.name || undefined;
      clientFirstName = c.name?.split(" ")[0] || clientFirstName;
      clientEmail = c.email || undefined;
      clientPhone = c.phone || undefined;
    }
  }
  if (!clientEmail && clientId) {
    const { data: { user: cu } } = await db.auth.admin.getUserById(clientId);
    if (cu) {
      clientEmail = cu.email || undefined;
      const metaName = cu.user_metadata?.full_name as string | undefined;
      if (metaName) { clientFullName = metaName; clientFirstName = metaName.split(" ")[0]; }
    }
  }
  return { clientFirstName, clientFullName, clientEmail, clientPhone };
}

function confirmationEmailHtml(clientName: string, whenStr: string, address: string, svcStr: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fff;">
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
            <tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #1a1a1a;">Address</td><td style="padding:10px 0;border-bottom:1px solid #1a1a1a;">${address}</td></tr>
            <tr><td style="padding:10px 0;color:#666;">Services</td><td style="padding:10px 0;">${svcStr}</td></tr>
          </table>
          <a href="https://www.luckimages.com/client" style="display:inline-block;margin-top:26px;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;text-decoration:none;">View in Your Portal →</a>
          <p style="margin:24px 0 0;font-size:12px;color:#555;line-height:1.6;">Need to change anything? Just reply to this email.</p>
          <p style="margin:16px 0 0;font-size:12px;color:#fff;font-weight:700;">Ryan Luck · Luck Images</p>
        </td></tr>
      </table>
    </td></tr></table></body></html>`;
}

// Fires the calendar invite (Ryan's calendar, Leif + client + photographers as
// attendees) and the client confirmation email for a shoot. Always creates the
// calendar event when a time is set — the client is only added as an attendee
// (and only gets the email) once we actually have their address on file.
export async function notifyShootBooked({
  address,
  scheduledAt,
  services,
  notes,
  contactId,
  clientId,
  photographerIds,
}: {
  address: string;
  scheduledAt: string | null | undefined;
  services: string[];
  notes?: string | null;
  contactId?: string | null;
  clientId?: string | null;
  photographerIds?: string[];
}): Promise<{ calendarOk: boolean; emailed: boolean; clientEmail?: string }> {
  const db = service();
  const { clientFirstName, clientFullName, clientEmail, clientPhone } = await resolveClientContact(contactId, clientId);

  const photographerEmails: string[] = [];
  for (const pid of photographerIds || []) {
    const { data: { user: pu } } = await db.auth.admin.getUserById(pid);
    if (pu?.email) photographerEmails.push(pu.email);
  }

  let calendarOk = false;
  if (scheduledAt) {
    try {
      await createShootEvent({
        address,
        scheduledAt,
        services: services || [],
        notes: notes || undefined,
        clientEmail,
        clientFullName,
        clientPhone,
        photographerEmails,
      });
      calendarOk = true;
    } catch (e) {
      console.error("notifyShootBooked: calendar event failed", e);
    }
  }

  let emailed = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && clientEmail && scheduledAt) {
    const whenStr = new Date(scheduledAt).toLocaleString("en-US", {
      weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
    });
    const svcStr = (services || []).join(", ") || "your shoot";
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Ryan Luck <ryan@luckimages.com>",
          to: [clientEmail],
          subject: `Confirmed: your Luck Images shoot — ${whenStr}`,
          html: confirmationEmailHtml(clientFirstName, whenStr, address, svcStr),
        }),
      });
      emailed = true;
    } catch (e) {
      console.error("notifyShootBooked: confirmation email failed", e);
    }
  }

  return { calendarOk, emailed, clientEmail };
}
