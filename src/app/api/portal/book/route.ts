import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { getDriveTime } from "@/lib/driveTime";
import { ADMIN_EMAILS } from "@/lib/constants";

// A realtor submits a booking request from their portal. Creates the shoot as
// a pending request, estimates drive time from home base, and alerts the team.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { address, lat, lng, scheduledAt, services, notes, accessInstructions, squareFootage } = await req.json();
  if (!address || !scheduledAt) {
    return NextResponse.json({ error: "Address and preferred date/time are required" }, { status: 400 });
  }

  // No dedicated access_instructions column yet — fold it into notes with a
  // clear label so it's never missed on the day of the shoot, without
  // needing a schema migration.
  const combinedNotes = [
    accessInstructions ? `🔑 Property Access: ${accessInstructions}` : null,
    notes || null,
  ].filter(Boolean).join("\n\n") || null;

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Who is booking
  const { data: contact } = await db.from("contacts").select("id, name, email, phone").eq("user_id", user.id).single();
  const clientName = contact?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "A client";

  // Drive-time estimate (null if no Maps key / lookup fails)
  const drive = await getDriveTime(address);

  const shootPayload: Record<string, unknown> = {
    client_id: user.id,
    contact_id: contact?.id || null,
    address,
    scheduled_at: scheduledAt,
    services: services || [],
    notes: combinedNotes,
    status: "pending",
    square_footage: squareFootage ? parseInt(squareFootage) : null,
    drive_minutes: drive?.minutes ?? null,
  };
  if (typeof lat === "number" && typeof lng === "number") {
    shootPayload.lat = lat;
    shootPayload.lng = lng;
  }

  // lat/lng columns are a recent addition — if the migration hasn't been run
  // yet in this environment, fall back to inserting without them rather than
  // failing the whole booking.
  let { data: shoot, error } = await db.from("shoots").insert(shootPayload).select().single();

  if (error && (error.message?.includes("lat") || error.message?.includes("lng"))) {
    delete shootPayload.lat;
    delete shootPayload.lng;
    ({ data: shoot, error } = await db.from("shoots").insert(shootPayload).select().single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const whenStr = new Date(scheduledAt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const svcStr = (services || []).join(", ") || "—";
  const driveStr = drive ? `${drive.text} (${drive.distanceText}) from home base` : "Drive time unavailable";
  const mapUrl = typeof lat === "number" && typeof lng === "number"
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`
    : null;

  // Command Center item — actionable, links to the board to confirm
  await db.from("company_updates").insert({
    message: `📅 New booking request — ${clientName} · ${address} · requested ${whenStr}\n---\nServices: ${svcStr}\nDrive: ${driveStr}${accessInstructions ? `\n🔑 Access: ${accessInstructions}` : ""}${mapUrl ? `\n📍 Confirmed pin: ${mapUrl}` : ""}\nReview & confirm on the board.`,
    created_by: "system",
    category: "shoots",
    link: "/dashboard/board",
  });

  // Email the team
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0c0c0c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#fff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;"><tr><td align="center" style="padding:40px 24px;">
        <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <tr><td style="padding-bottom:24px;">
            <p style="margin:0;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#4ade80;">Luck Images · New Booking Request</p>
          </td></tr>
          <tr><td style="border:1px solid rgba(255,255,255,0.1);padding:32px;">
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px;color:#fff;">${clientName} wants to book</h1>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#ccc;">
              <tr><td style="padding:6px 0;color:#666;width:120px;">Address</td><td style="padding:6px 0;">${address}${mapUrl ? ` &middot; <a href="${mapUrl}" style="color:#4ade80;">View confirmed pin →</a>` : ""}</td></tr>
              <tr><td style="padding:6px 0;color:#666;">Requested</td><td style="padding:6px 0;">${whenStr}</td></tr>
              <tr><td style="padding:6px 0;color:#666;">Services</td><td style="padding:6px 0;">${svcStr}</td></tr>
              ${squareFootage ? `<tr><td style="padding:6px 0;color:#666;">Sq Ft</td><td style="padding:6px 0;">${squareFootage}</td></tr>` : ""}
              <tr><td style="padding:6px 0;color:#666;">Drive time</td><td style="padding:6px 0;color:#4ade80;">${driveStr}</td></tr>
              ${contact?.phone ? `<tr><td style="padding:6px 0;color:#666;">Phone</td><td style="padding:6px 0;">${contact.phone}</td></tr>` : ""}
              ${accessInstructions ? `<tr><td style="padding:6px 0;color:#4ade80;vertical-align:top;">🔑 Access</td><td style="padding:6px 0;color:#4ade80;font-weight:700;">${accessInstructions}</td></tr>` : ""}
              ${notes ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top;">Notes</td><td style="padding:6px 0;">${notes}</td></tr>` : ""}
            </table>
            <a href="https://www.luckimages.com/dashboard/board" style="display:inline-block;margin-top:24px;background:#fff;color:#000;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;text-decoration:none;">Review &amp; Confirm →</a>
          </td></tr>
        </table>
      </td></tr></table></body></html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Luck Images <ryan@luckimages.com>",
        to: ADMIN_EMAILS,
        subject: `New booking request — ${clientName} · ${address}`,
        html,
      }),
    });
  }

  return NextResponse.json({ ok: true, shoot });
}
