import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { notifyDelivery } from "@/lib/deliveryInvoice";

// PATCH — photographer advances shoot status
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();

  // Only allow photographer-owned stages
  const ALLOWED = ["en_route", "on_site", "wrapping", "editing", "delivered"];
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify this photographer is assigned to this shoot
  const { data: shoot } = await service
    .from("shoots")
    .select("id, address, scheduled_at, photographer_ids, status")
    .eq("id", id)
    .single();

  if (!shoot || !shoot.photographer_ids?.includes(user.id)) {
    return NextResponse.json({ error: "Not your shoot" }, { status: 403 });
  }

  const { error } = await service.from("shoots").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // First time this shoot reaches "delivered" — notify client media is ready.
  // email the client a link to their media + a link to pay. Awaited (not
  // fire-and-forget) since Vercel can freeze the function once the response
  // is sent, killing any work still in flight.
  if (status === "delivered" && shoot.status !== "delivered") {
    try { await notifyDelivery(id); } catch (e) { console.error("delivery notify failed", e); }
  }

  // Get photographer's display name
  const { data: profile } = await service.from("profiles").select("full_name").eq("id", user.id).single();
  const photographerName = profile?.full_name || user.email?.split("@")[0] || "Photographer";

  const stageMessages: Record<string, string> = {
    en_route:  `🚗 En route — ${shoot.address}`,
    on_site:   `📍 Arrived on site — ${shoot.address}`,
    wrapping:  `✅ Wrapping up — ${shoot.address}`,
    editing:   `🖥️ Editing started — ${shoot.address}`,
    delivered: `📦 Media delivered — ${shoot.address}`,
  };

  const message = stageMessages[status];
  if (message) {
    await service.from("company_updates").insert({ message, created_by: photographerName });
  }

  return NextResponse.json({ ok: true });
}
