import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Booking requests from /ethan go straight to Ethan's inbox — deliberately
// NOT into the Nocturne CRM, since this is his business, not Luck Images'.
// The address is env-overridable so it can be repointed when the site moves
// to his own domain without a code change.
const TO = process.env.ETHAN_BOOKING_EMAIL || "egsimpson03@gmail.com";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(request: NextRequest) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const allowed = await checkRateLimit(db, `ethan-booking:${getClientIp(request)}`, { max: 5, windowSeconds: 600 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests — please try again in a few minutes." }, { status: 429 });
  }

  const {
    firstName, lastName, email, phone,
    eventDate, eventTime, guests, location,
    eventType, menuStyle, customMenu, dietary, notes,
  } = await request.json();

  if (!firstName || !lastName || !email || !phone || !eventDate || !eventTime || !guests || !location || !menuStyle) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const name = `${firstName} ${lastName}`.trim();

  // Date comes in as YYYY-MM-DD; pin it to midday so the label can't slip a
  // day when the server renders it in UTC.
  const prettyDate = new Date(`${eventDate}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const prettyTime = new Date(`${eventDate}T${eventTime}`).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit",
  });

  const rows: [string, string | null][] = [
    ["Name", name],
    ["Email", email],
    ["Phone", phone],
    ["Date", prettyDate],
    ["Start time", prettyTime],
    ["Guests", String(guests)],
    ["Location", location],
    ["Occasion", eventType || null],
    ["Menu style", menuStyle],
    ["Custom menu idea", customMenu || null],
    ["Allergies / dietary", dietary || null],
    ["Notes", notes || null],
  ];
  const present = rows.filter((r): r is [string, string] => Boolean(r[1]));

  const text = present.map(([k, v]) => `${k}: ${v}`).join("\n");

  const html = `
    <div style="font-family:Georgia,serif;background:#0c0c0c;color:#F2EDE4;padding:32px">
      <p style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#C9A44C;margin:0 0 8px">
        New Booking Request
      </p>
      <h1 style="font-size:26px;font-weight:400;margin:0 0 4px">${esc(name)}</h1>
      <p style="color:#A89F93;margin:0 0 24px;font-size:14px">
        ${esc(prettyDate)} at ${esc(prettyTime)} · ${esc(String(guests))} guests · ${esc(menuStyle)}
      </p>
      <table style="border-collapse:collapse;width:100%;font-family:Helvetica,Arial,sans-serif;font-size:14px">
        ${present.map(([k, v]) => `
          <tr>
            <td style="padding:10px 16px 10px 0;color:#A89F93;white-space:nowrap;vertical-align:top;border-top:1px solid rgba(201,164,76,0.2)">${esc(k)}</td>
            <td style="padding:10px 0;color:#F2EDE4;vertical-align:top;border-top:1px solid rgba(201,164,76,0.2)">${esc(v).replace(/\n/g, "<br>")}</td>
          </tr>`).join("")}
      </table>
      <p style="color:#A89F93;font-size:12px;margin:24px 0 0;font-family:Helvetica,Arial,sans-serif">
        Reply to this email to answer ${esc(firstName)} directly.
      </p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Chef Bookings <ryan@luckimages.com>",
      to: [TO],
      reply_to: email,
      subject: `New booking request — ${name} · ${prettyDate} · ${guests} guests`,
      text,
      html,
    }),
  });

  if (!res.ok) {
    // Nothing else stores this request, so a send failure has to surface to
    // the visitor — the form tells them to email Ethan directly instead.
    console.error("ethan booking: resend error", await res.text());
    return NextResponse.json({ error: "Couldn't send your request. Please email egsimpson03@gmail.com directly." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
