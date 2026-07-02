import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { createShootEvent } from "@/lib/googleCalendar";
import { sendPushToAdmins, sendPushToUser } from "@/lib/push";

function service() {
  return createAdminClient();
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";
  const full = searchParams.get("full") === "1"; // all statuses including completed/cancelled

  const query = supabase
    .from("shoots")
    .select("id, address, scheduled_at, services, notes, square_footage, client_id, contact_id, status, photographer_ids, price, package_name, property_type, checked_in_at, delivered_at, paid_at")
    .order("scheduled_at", { ascending: false });

  if (full) { /* no filter — return all */ }
  else if (!all) query.eq("status", "pending");
  else query.in("status", ["pending", "scheduled", "en_route", "on_site", "wrapping", "editing"]);

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

  // Also resolve contact names for contact_id-based shoots
  const contactIds = [...new Set((shoots ?? []).map(s => s.contact_id).filter(Boolean))];
  const contactNameMap: Record<string, string> = {};
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase.from("contacts").select("id, name").in("id", contactIds);
    for (const c of contacts ?? []) contactNameMap[c.id] = c.name;
  }

  const result = (shoots ?? []).map(s => ({
    ...s,
    client_name: contactNameMap[s.contact_id] || nameMap[s.client_id] || emailMap[s.client_id] || "",
    client_email: emailMap[s.client_id] || "",
    photographer_ids: s.photographer_ids || [],
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { address, scheduled_at, services, notes, square_footage, client_id, contact_id, photographer_ids, status: reqStatus, price, package_name, property_type } = await req.json();
  if (!address?.trim()) return NextResponse.json({ error: "Address required" }, { status: 400 });

  const db = service();
  const insertStatus = reqStatus === "scheduled" ? "scheduled" : "pending";

  // If a contact_id is provided and that contact has a portal account, link client_id too
  // so the shoot appears in their client portal (which queries by client_id)
  let resolvedClientId = client_id || null;
  let resolvedContactName = "";
  if (contact_id && !resolvedClientId) {
    const { data: contact } = await db.from("contacts").select("user_id, name").eq("id", contact_id).single();
    if (contact?.user_id) resolvedClientId = contact.user_id;
    resolvedContactName = contact?.name ?? "";
  }

  const payload: Record<string, unknown> = {
    address: address.trim(),
    scheduled_at: scheduled_at || null,
    services: services || [],
    notes: notes?.trim() || null,
    square_footage: square_footage || null,
    client_id: resolvedClientId,
    contact_id: contact_id || null,
    photographer_ids: photographer_ids || [],
    status: insertStatus,
    price: price || null,
    package_name: package_name || null,
    property_type: property_type || null,
  };

  const { data, error } = await db.from("shoots").insert(payload).select().single();

  // Auto-promote contact to "client" stage
  if (!error && contact_id) {
    await db.from("contacts").update({ stage: "client" }).eq("id", contact_id).in("stage", ["lead", "interested", "follow-up", "booked", "registered"]);
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Google Calendar event
  if (insertStatus === "scheduled" && data.scheduled_at) {
    try {
      await createShootEvent({
        address: data.address, scheduledAt: data.scheduled_at,
        services: data.services ?? [], notes: data.notes ?? "",
        clientName: resolvedContactName || undefined,
      });
    } catch (e) { console.error("Calendar event failed:", e); }
  }

  // Push to assigned photographers
  if (photographer_ids?.length) {
    try {
      const dateStr = scheduled_at ? new Date(scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
      await Promise.all(photographer_ids.map((uid: string) =>
        sendPushToUser(uid, "📷 Shoot Assigned", `${address.trim()}${dateStr ? " · " + dateStr : ""}`, { shootId: data.id })
      ));
    } catch (e) { console.error("Photographer push failed:", e); }
  }

  // Notify admins
  try {
    await sendPushToAdmins(
      "📷 New Shoot Booked",
      `${address.trim()}${scheduled_at ? " · " + new Date(scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}`,
      { shootId: data.id }
    );
  } catch (e) { console.error("Push notification failed:", e); }

  return NextResponse.json({ shoot: data });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { id, status, photographer_ids, price, package_name, contact_id, address, scheduled_at, services, notes, square_footage, property_type } = await req.json();

  // Fetch shoot details before updating (needed for calendar event + status check)
  const { data: shoot } = await supabase
    .from("shoots")
    .select("id, address, scheduled_at, services, notes, client_id, status, checked_in_at, delivered_at, paid_at")
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

  // Set checked_in_at the first time a photographer moves to an active status
  if (["en_route", "on_site", "wrapping"].includes(status) && shoot && !["en_route", "on_site", "wrapping"].includes(shoot.status)) {
    updatePayload.checked_in_at = new Date().toISOString();
  }

  // Set delivered_at when first moving to delivered
  if (status === "delivered" && shoot?.status !== "delivered") {
    updatePayload.delivered_at = new Date().toISOString();
  }

  // Mark paid
  if (status === "paid") {
    updatePayload.status = "completed";
    updatePayload.paid_at = new Date().toISOString();
  }

  if (photographer_ids !== undefined) updatePayload.photographer_ids = photographer_ids;
  if (price !== undefined) updatePayload.price = price;
  if (package_name !== undefined) updatePayload.package_name = package_name;
  if (contact_id !== undefined) updatePayload.contact_id = contact_id;
  if (address !== undefined) updatePayload.address = address;
  if (scheduled_at !== undefined) updatePayload.scheduled_at = scheduled_at;
  if (services !== undefined) updatePayload.services = services;
  if (notes !== undefined) updatePayload.notes = notes;
  if (square_footage !== undefined) updatePayload.square_footage = square_footage;
  if (property_type !== undefined) updatePayload.property_type = property_type;

  const { error } = await supabase.from("shoots").update(updatePayload).eq("id", id);

  // Auto-promote contact to "client" stage when attached
  if (!error && contact_id) {
    await supabase.from("contacts").update({ stage: "client" }).eq("id", contact_id).in("stage", ["lead", "interested", "follow-up", "booked", "registered"]);
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire a notification for significant status changes
  if (status && shoot) {
    const STATUS_LABELS: Record<string, string> = {
      scheduled:  "Scheduled",
      en_route:   "Photographer en route",
      on_site:    "Photographer on site",
      wrapping:   "Wrapping up",
      editing:    "In editing",
      delivered:  "Delivered to client",
      paid:       "Invoice paid",
      completed:  "Marked complete",
      cancelled:  "Cancelled",
    };
    const label = STATUS_LABELS[status] || status;
    const addr = shoot.address || "shoot";
    const notifMsg = `${label} — ${addr}`;
    await supabase.from("company_updates").insert({ message: notifMsg, created_by: "system", link: "/dashboard/board", category: "shoots" });
  }

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
