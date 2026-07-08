import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

// A realtor edits or cancels a shoot they booked themselves. Ownership is
// checked server-side (client_id or linked contact_id must match the caller)
// so a realtor can never touch another client's shoot, and only shoots still
// in a pre-shoot state can be changed — once work is underway, edits should
// go through the team instead of silently changing on them mid-shoot.
const EDITABLE_STATUSES = ["pending", "scheduled"];

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, cancel } = body;
  if (!id) return NextResponse.json({ error: "Shoot id required" }, { status: 400 });

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: contact } = await db.from("contacts").select("id").eq("user_id", user.id).single();
  const { data: shoot } = await db.from("shoots").select("id, address, client_id, contact_id, status").eq("id", id).single();

  if (!shoot || (shoot.client_id !== user.id && (!contact || shoot.contact_id !== contact.id))) {
    return NextResponse.json({ error: "Shoot not found" }, { status: 404 });
  }
  if (!EDITABLE_STATUSES.includes(shoot.status)) {
    return NextResponse.json({ error: "This shoot can no longer be changed — contact us directly." }, { status: 400 });
  }

  if (cancel) {
    const { error } = await db.from("shoots").update({ status: "cancelled" }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await db.from("company_updates").insert({
      message: `🚫 Booking cancelled by client — ${shoot.address || ""}`.trim(),
      created_by: "system",
      category: "shoots",
      link: "/dashboard/board",
    });

    return NextResponse.json({ ok: true });
  }

  const { address, lat, lng, scheduledAt, services, notes, accessInstructions, squareFootage } = body;

  // Same "ACCESS: " prefix convention the admin board's parseNotes() expects.
  const combinedNotes = [
    accessInstructions ? `ACCESS: ${accessInstructions}` : "",
    notes || "",
  ].filter(Boolean).join("\n\n") || null;

  const updatePayload: Record<string, unknown> = {};
  if (address !== undefined) updatePayload.address = address;
  if (typeof lat === "number") updatePayload.lat = lat;
  if (typeof lng === "number") updatePayload.lng = lng;
  if (scheduledAt !== undefined) updatePayload.scheduled_at = scheduledAt;
  if (services !== undefined) updatePayload.services = services;
  if (notes !== undefined || accessInstructions !== undefined) updatePayload.notes = combinedNotes;
  if (squareFootage !== undefined) updatePayload.square_footage = squareFootage ? parseInt(squareFootage) : null;

  let { error } = await db.from("shoots").update(updatePayload).eq("id", id);

  // lat/lng columns are a recent addition — degrade gracefully if a given
  // environment hasn't run the migration yet.
  if (error && (error.message?.includes("lat") || error.message?.includes("lng"))) {
    delete updatePayload.lat;
    delete updatePayload.lng;
    ({ error } = await db.from("shoots").update(updatePayload).eq("id", id));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
