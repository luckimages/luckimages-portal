import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { sendPushToAdmins, sendPushToUser } from "@/lib/push";
import { notifyDelivery } from "@/lib/deliveryInvoice";
import { notifyShootBooked } from "@/lib/shootConfirmation";
import { createConfirmationInvoice } from "@/lib/confirmationInvoice";

function service() {
  return createAdminClient();
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";
  const full = searchParams.get("full") === "1"; // all statuses including completed/cancelled

  const statusFilter = full ? "all" : !all ? "pending" : "active";

  const withLatLng = supabase.from("shoots")
    .select("id, address, scheduled_at, services, notes, square_footage, client_id, contact_id, status, photographer_ids, price, package_name, property_type, checked_in_at, delivered_at, paid_at, drive_minutes, lat, lng")
    .order("scheduled_at", { ascending: false });
  if (statusFilter === "pending") withLatLng.eq("status", "pending");
  else if (statusFilter === "active") withLatLng.in("status", ["pending", "scheduled", "en_route", "on_site", "wrapping", "editing"]);

  // lat/lng columns are a recent addition — if the migration hasn't run yet
  // in this environment, fall back to the base column set.
  const first = await withLatLng;
  let shoots: Array<Record<string, any>> | null = first.data; // eslint-disable-line @typescript-eslint/no-explicit-any
  let error = first.error;
  if (error && (error.message?.includes("lat") || error.message?.includes("lng"))) {
    const withoutLatLng = supabase.from("shoots")
      .select("id, address, scheduled_at, services, notes, square_footage, client_id, contact_id, status, photographer_ids, price, package_name, property_type, checked_in_at, delivered_at, paid_at, drive_minutes")
      .order("scheduled_at", { ascending: false });
    if (statusFilter === "pending") withoutLatLng.eq("status", "pending");
    else if (statusFilter === "active") withoutLatLng.in("status", ["pending", "scheduled", "en_route", "on_site", "wrapping", "editing"]);
    const second = await withoutLatLng;
    shoots = second.data;
    error = second.error;
  }

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

  const { address, lat, lng, scheduled_at, services, notes, square_footage, client_id, contact_id, contact_email, photographer_ids, status: reqStatus, price, package_name, property_type } = await req.json();
  if (!address?.trim()) return NextResponse.json({ error: "Address required" }, { status: 400 });

  const db = service();
  let insertStatus = reqStatus === "scheduled" ? "scheduled" : "pending";

  // If a contact_id is provided and that contact has a portal account, link client_id too
  // so the shoot appears in their client portal (which queries by client_id)
  let resolvedClientId = client_id || null;
  let resolvedContactName = "";
  let hasClientEmail = true;
  if (contact_id) {
    const { data: contact } = await db.from("contacts").select("user_id, name, email").eq("id", contact_id).single();
    if (contact?.user_id && !resolvedClientId) resolvedClientId = contact.user_id;
    resolvedContactName = contact?.name ?? "";

    // Need an email to invite the client to the calendar event / send the
    // confirmation. Use the one just typed into the New Shoot form if the
    // contact doesn't have one on file yet, and save it for next time.
    hasClientEmail = !!(contact?.email || contact_email);
    if (!contact?.email && contact_email) {
      await db.from("contacts").update({ email: contact_email }).eq("id", contact_id);
    }
  }

  // No email on file and none provided — hold the shoot as pending (with the
  // date/photographer already locked in) instead of silently booking a shoot
  // the client never hears about.
  let combinedNotes = notes?.trim() || null;
  if (contact_id && !hasClientEmail) {
    insertStatus = "pending";
    combinedNotes = [combinedNotes, `⚠ Missing ${resolvedContactName || "client"}'s email — add it and confirm to notify them.`].filter(Boolean).join("\n\n");
  }

  const payload: Record<string, unknown> = {
    address: address.trim(),
    scheduled_at: scheduled_at || null,
    services: services || [],
    notes: combinedNotes,
    square_footage: square_footage || null,
    client_id: resolvedClientId,
    contact_id: contact_id || null,
    photographer_ids: photographer_ids || [],
    status: insertStatus,
    price: price || null,
    package_name: package_name || null,
    property_type: property_type || null,
  };
  if (typeof lat === "number") payload.lat = lat;
  if (typeof lng === "number") payload.lng = lng;

  let { data, error } = await db.from("shoots").insert(payload).select().single();

  // lat/lng columns are a recent addition — if the migration hasn't run yet
  // in this environment, retry without them rather than failing the create.
  if (error && (error.message?.includes("lat") || error.message?.includes("lng"))) {
    delete payload.lat;
    delete payload.lng;
    ({ data, error } = await db.from("shoots").insert(payload).select().single());
  }

  // Auto-promote contact to "client" stage
  if (!error && contact_id) {
    await db.from("contacts").update({ stage: "client" }).eq("id", contact_id).in("stage", ["lead", "interested", "follow-up", "booked", "registered"]);
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Calendar invite (Ryan's calendar, Leif + client + photographers) and the
  // client confirmation email. Only fires when the shoot is actually locked
  // in as scheduled — a shoot held as pending (missing client email, or a
  // portal request awaiting confirmation) gets its one calendar event at the
  // Confirm & Notify step instead, so it's never created twice.
  if (insertStatus === "scheduled") {
    try {
      await notifyShootBooked({
        address: data.address,
        scheduledAt: data.scheduled_at,
        services: data.services ?? [],
        notes: data.notes ?? "",
        contactId: contact_id || null,
        clientId: resolvedClientId,
        photographerIds: photographer_ids || [],
      });
    } catch (e) { console.error("notifyShootBooked failed:", e); }
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

  const { id, status, photographer_ids, price, line_items, package_name, contact_id, address, lat, lng, scheduled_at, services, notes, square_footage, property_type } = await req.json();

  // Fetch shoot details before updating (needed for calendar event + status check)
  const { data: shoot } = await supabase
    .from("shoots")
    .select("id, address, scheduled_at, services, notes, client_id, contact_id, photographer_ids, status, checked_in_at, delivered_at, paid_at")
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
  if (line_items !== undefined) updatePayload.line_items = line_items;
  if (package_name !== undefined) updatePayload.package_name = package_name;
  if (contact_id !== undefined) updatePayload.contact_id = contact_id;
  if (address !== undefined) updatePayload.address = address;
  if (scheduled_at !== undefined) updatePayload.scheduled_at = scheduled_at;
  if (services !== undefined) updatePayload.services = services;
  if (notes !== undefined) updatePayload.notes = notes;
  if (square_footage !== undefined) updatePayload.square_footage = square_footage;
  if (property_type !== undefined) updatePayload.property_type = property_type;
  if (typeof lat === "number") updatePayload.lat = lat;
  if (typeof lng === "number") updatePayload.lng = lng;

  let { error } = await supabase.from("shoots").update(updatePayload).eq("id", id);

  // lat/lng columns are a recent addition — if the migration hasn't run yet
  // in this environment, retry without them rather than failing the update.
  if (error && (error.message?.includes("lat") || error.message?.includes("lng"))) {
    delete updatePayload.lat;
    delete updatePayload.lng;
    ({ error } = await supabase.from("shoots").update(updatePayload).eq("id", id));
  }

  // Auto-promote contact to "client" stage when attached
  if (!error && contact_id) {
    await supabase.from("contacts").update({ stage: "client" }).eq("id", contact_id).in("stage", ["lead", "interested", "follow-up", "booked", "registered"]);
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // First time this shoot reaches "delivered" — notify the client their media
  // is ready. Invoice was already created at confirmation; this just sends the
  // "photos are ready" email + SMS.
  if (status === "delivered" && shoot?.status !== "delivered") {
    try { await notifyDelivery(id); } catch (e) { console.error("delivery notify failed", e); }
  }

  // Invoice created at confirmation (pending → scheduled). Idempotent if already
  // exists (e.g. if the shoot was directly confirmed with status: "scheduled").
  if (status === "scheduled" && shoot?.status !== "scheduled") {
    try { await createConfirmationInvoice(id); } catch (e) { console.error("confirmationInvoice failed:", e); }
  }

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

  // Only fire the calendar invite + confirmation email when transitioning
  // pending → scheduled (not on every edit to an already-scheduled shoot).
  if (status === "scheduled" && shoot?.scheduled_at && shoot?.status === "pending") {
    try {
      await notifyShootBooked({
        address: shoot.address,
        scheduledAt: shoot.scheduled_at,
        services: shoot.services ?? [],
        notes: shoot.notes ?? "",
        contactId: contact_id ?? shoot.contact_id,
        clientId: shoot.client_id,
        photographerIds: photographer_ids ?? shoot.photographer_ids ?? [],
      });
    } catch (calErr) {
      console.error("notifyShootBooked failed:", calErr);
      // Don't fail the whole request if calendar/email fails
    }
  }

  return NextResponse.json({ ok: true });
}
