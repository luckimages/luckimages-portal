import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";
import { notifyDelivery, ensureDeliveryInvoice } from "@/lib/deliveryInvoice";

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
    .select("id, status, address, price, line_items, contact_id, client_id, scheduled_at")
    .eq("id", shootId)
    .single();
  if (!shoot) return NextResponse.json({ error: "Shoot not found" }, { status: 404 });

  const { error } = await db.from("shoots").update({ status: "delivered" }).eq("id", shootId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await ensureDeliveryInvoice(shootId);

  if (shoot.status !== "delivered") {
    try { await notifyDelivery(shootId); } catch (e) { console.error("delivery notify failed", e); }
  }

  return NextResponse.json({ ok: true });
}
