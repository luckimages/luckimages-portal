import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";
import { notifyDelivery, ensureDeliveryInvoice, maybeCompleteShoot } from "@/lib/deliveryInvoice";
import { addDays, contactIdForShoot, createAutoFollowUp, todayCentral } from "@/lib/followUps";

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shootId } = await req.json();
  if (!shootId) return NextResponse.json({ error: "shootId required" }, { status: 400 });

  const db = service();

  const { data: shoot } = await db
    .from("shoots")
    .select("id, status, address, price, line_items, contact_id, client_id, scheduled_at, editing_cost_cents")
    .eq("id", shootId)
    .single();
  if (!shoot) return NextResponse.json({ error: "Shoot not found" }, { status: 404 });

  // Editing cost must be recorded before a shoot can be delivered.
  if (shoot.status !== "delivered" && shoot.status !== "completed" && shoot.editing_cost_cents == null) {
    return NextResponse.json(
      { error: "Record the editing cost for this shoot before delivering." },
      { status: 400 }
    );
  }

  // delivered_at wasn't being set here — only the generic PATCH /api/admin/shoots
  // handler set it, so a shoot delivered through this (the actual "Deliver"
  // button's) route never got it, breaking anything keyed off delivered_at
  // (e.g. the client portal's "your photos are ready" banner).
  const updatePayload: { status: string; delivered_at?: string } = { status: "delivered" };
  if (shoot.status !== "delivered") updatePayload.delivered_at = new Date().toISOString();

  const { error } = await db.from("shoots").update(updatePayload).eq("id", shootId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await ensureDeliveryInvoice(shootId);

  if (shoot.status !== "delivered") {
    try { await notifyDelivery(shootId); } catch (e) { console.error("delivery notify failed", e); }

    // Post-delivery check-in 3 days out (Updates → Follow-ups Due). Once per
    // shoot, and never on top of a follow-up that's already scheduled.
    try {
      const contactId = await contactIdForShoot(db, shoot);
      if (contactId) {
        await createAutoFollowUp(db, {
          autoKey: `checkin:${shoot.id}`,
          contactId,
          dueDate: addDays(todayCentral(), 3),
          title: `Check in — how did the ${shoot.address || "listing"} photos land?`,
          note: "Photos delivered 3 days ago. Ask how the listing is doing and whether another one is coming up.",
          createdBy: "delivery",
        });
      }
    } catch (e) { console.error("post-delivery check-in failed", e); }
  }

  // Covers the case where there's no invoice to pay (e.g. a $0 shoot) or the
  // invoice was already paid before delivery — otherwise this fires later
  // from the Stripe webhook once the client actually pays.
  await maybeCompleteShoot(shootId);

  return NextResponse.json({ ok: true });
}
