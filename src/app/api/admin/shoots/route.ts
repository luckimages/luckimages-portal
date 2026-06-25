import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createShootEvent } from "@/lib/googleCalendar";
import { sendPushToAdmins, sendPushToUser } from "@/lib/push";

const ADMIN_EMAILS = ["ryan@luckimages.com", "leif@luckimages.com"];

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";
  const full = searchParams.get("full") === "1"; // all statuses including completed/cancelled

  const query = supabase
    .from("shoots")
    .select("id, address, scheduled_at, services, notes, square_footage, client_id, status, photographer_ids, price, package_name")
    .order("scheduled_at", { ascending: false });

  if (full) { /* no filter — return all */ }
  else if (!all) query.eq("status", "pending");
  else query.in("status", ["pending", "scheduled"]);

  const { data: shoots, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Look up client names from profiles
  const clientIds = [...new Set((shoots ?? []).map(s => s.client_id).filter(Boolean))];
  const nameMap: Record<string, string> = {};
  const emailMap: Record<string, string> = {};

  if (clientIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", clientIds);
    for (const p of profiles ?? []) {
      nameMap[p.id] = p.full_name ?? "";
    }

    // Also grab emails from auth
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users?.users ?? []) {
      if (clientIds.includes(u.id)) emailMap[u.id] = u.email ?? "";
    }
  }

  const result = (shoots ?? []).map(s => ({
    ...s,
    client_name: nameMap[s.client_id] || emailMap[s.client_id] || s.client_id,
    client_email: emailMap[s.client_id] || "",
    photographer_ids: s.photographer_ids || [],
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { address, scheduled_at, services, notes, square_footage, client_id, contact_id, photographer_ids, status: reqStatus, price, package_name } = await req.json();
  if (!address?.trim()) return NextResponse.json({ error: "Address required" }, { status: 400 });

  const db = service();
  const insertStatus = reqStatus === "scheduled" ? "scheduled" : "pending";
  const payload: Record<string, unknown> = {
    address: address.trim(),
    scheduled_at: scheduled_at || null,
    services: services || [],
    notes: notes?.trim() || null,
    square_footage: square_footage || null,
    client_id: client_id || null,
    contact_id: contact_id || null,
    photographer_ids: photographer_ids || [],
    status: insertStatus,
    price: price || null,
    package_name: package_name || null,
  };

  const { data, error } = await db.from("shoots").insert(payload).select().single();

  // Auto-promote contact to "client" stage
  if (!error && contact_id) {
    await db.from("contacts").update({ stage: "client" }).eq("id", contact_id).in("stage", ["lead", "interested", "follow-up", "booked", "registered"]);
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If created as scheduled, fire Google Calendar event immediately
  if (insertStatus === "scheduled" && data.scheduled_at) {
    try {
      let clientName = ""; let clientEmail = "";
      if (client_id) {
        const { data: profile } = await db.from("profiles").select("full_name").eq("id", client_id).single();
        clientName = profile?.full_name ?? "";
        const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
        const u = users?.users.find((u: {id: string}) => u.id === client_id);
        clientEmail = (u as {email?: string})?.email ?? "";
      }
      await createShootEvent({
        address: data.address, scheduledAt: data.scheduled_at,
        services: data.services ?? [], notes: data.notes ?? "",
        clientEmail: clientEmail || undefined, clientName: clientName || undefined,
      });
    } catch (e) { console.error("Calendar event failed:", e); }
  }

  // Notify admins of new booking
  try {
    await sendPushToAdmins(
      "📷 New Shoot Requested",
      `${address.trim()}${scheduled_at ? " · " + new Date(scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}`,
      { shootId: data.id }
    );
  } catch (e) { console.error("Push notification failed:", e); }

  return NextResponse.json({ shoot: data });
}

export async function PATCH(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { id, status, photographer_ids, price, package_name, contact_id } = await req.json();

  // Fetch shoot details before updating (needed for calendar event + status check)
  const { data: shoot } = await supabase
    .from("shoots")
    .select("id, address, scheduled_at, services, notes, client_id, status")
    .eq("id", id)
    .single();

  // Block completion if no media uploaded
  if (status === "completed") {
    const { count } = await supabase.from("media").select("id", { count: "exact", head: true }).eq("shoot_id", id);
    if (!count || count === 0) {
      return NextResponse.json({ error: "No media uploaded yet. Upload photos before marking complete." }, { status: 400 });
    }
  }

  const updatePayload: Record<string, unknown> = { status };
  if (photographer_ids !== undefined) updatePayload.photographer_ids = photographer_ids;
  if (price !== undefined) updatePayload.price = price;
  if (package_name !== undefined) updatePayload.package_name = package_name;
  if (contact_id !== undefined) updatePayload.contact_id = contact_id;

  const { error } = await supabase.from("shoots").update(updatePayload).eq("id", id);

  // Auto-promote contact to "client" stage when attached
  if (!error && contact_id) {
    await supabase.from("contacts").update({ stage: "client" }).eq("id", contact_id).in("stage", ["lead", "interested", "follow-up", "booked", "registered"]);
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify newly assigned photographers
  if (photographer_ids?.length && shoot) {
    try {
      const dateStr = shoot.scheduled_at
        ? new Date(shoot.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : "";
      await Promise.all(photographer_ids.map((uid: string) =>
        sendPushToUser(uid, "📷 Shoot Assigned", `${shoot.address}${dateStr ? " · " + dateStr : ""}`, { shootId: id })
      ));
    } catch (e) { console.error("Push notification failed:", e); }
  }

  // Notify client when shoot is confirmed (pending → scheduled)
  if (status === "scheduled" && shoot?.status === "pending" && shoot?.client_id) {
    try {
      const dateStr = shoot.scheduled_at
        ? new Date(shoot.scheduled_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
        : "";
      await sendPushToUser(shoot.client_id, "✅ Shoot Confirmed", `Your shoot at ${shoot.address}${dateStr ? " is confirmed for " + dateStr : " has been confirmed."}`);
    } catch (e) { console.error("Push notification failed:", e); }
  }

  // Only create calendar event when transitioning pending → scheduled (not already scheduled)
  if (status === "scheduled" && shoot?.scheduled_at && shoot?.status === "pending") {
    try {
      // Resolve client name + email
      let clientName = "";
      let clientEmail = "";
      if (shoot.client_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", shoot.client_id)
          .single();
        clientName = profile?.full_name ?? "";

        const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const user = users?.users.find(u => u.id === shoot.client_id);
        clientEmail = user?.email ?? "";
      }

      await createShootEvent({
        address: shoot.address,
        scheduledAt: shoot.scheduled_at,
        services: shoot.services ?? [],
        notes: shoot.notes ?? "",
        clientEmail: clientEmail || undefined,
        clientName: clientName || undefined,
      });
    } catch (calErr) {
      console.error("Google Calendar event creation failed:", calErr);
      // Don't fail the whole request if calendar fails
    }
  }

  return NextResponse.json({ ok: true });
}
