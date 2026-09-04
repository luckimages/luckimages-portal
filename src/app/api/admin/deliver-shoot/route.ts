import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ADMIN_EMAILS } from "@/lib/constants";
import { notifyDelivery } from "@/lib/deliveryInvoice";

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

  // Auto-create invoice if none exists for this shoot yet
  const { data: existing } = await db.from("invoices").select("id").eq("shoot_id", shootId).maybeSingle();
  if (!existing) {
    const lineItems: Array<{ label: string; amount_cents: number }> = shoot.line_items || [];
    const totalCents = lineItems.length > 0
      ? lineItems.reduce((sum: number, li: { label: string; amount_cents: number }) => sum + li.amount_cents, 0)
      : Math.round((shoot.price ?? 0) * 100);
    if (totalCents > 0) {
      await db.from("invoices").insert({
        shoot_id: shoot.id,
        contact_id: shoot.contact_id || null,
        client_id: shoot.client_id || null,
        amount_cents: totalCents,
        line_items: lineItems.length > 0 ? lineItems : null,
        description: `Luck Images — ${shoot.address}`,
        paid: false,
        created_at: shoot.scheduled_at || new Date().toISOString(),
      });
    }
  }

  if (shoot.status !== "delivered") {
    try { await notifyDelivery(shootId); } catch (e) { console.error("delivery notify failed", e); }
  }

  return NextResponse.json({ ok: true });
}
