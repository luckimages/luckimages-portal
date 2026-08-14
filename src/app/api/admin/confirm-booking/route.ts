import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { notifyShootBooked } from "@/lib/shootConfirmation";
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

  // Calendar invite (Ryan's calendar, Leif + client + photographers) and the
  // client confirmation email — shared with New Shoot creation so both paths
  // behave identically.
  const { calendarOk, emailed: clientEmailed, clientEmail } = await notifyShootBooked({
    address: shoot.address,
    scheduledAt: finalTime,
    services: shoot.services || [],
    notes: shoot.notes || undefined,
    contactId: shoot.contact_id,
    clientId: shoot.client_id,
    photographerIds: finalPhotographers || [],
  });

  const whenStr = new Date(finalTime).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });

  // Command Center
  await db.from("company_updates").insert({
    message: `✅ Booking confirmed — ${shoot.address} · ${whenStr}`,
    created_by: user.email?.split("@")[0] || "admin",
    category: "shoots",
    link: "/dashboard/board",
  });

  return NextResponse.json({ ok: true, calendarOk, emailed: clientEmailed, clientEmail });
}
