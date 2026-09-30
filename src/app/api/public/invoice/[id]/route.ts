import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function db() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Public, no-login lookup for a shared invoice link — the invoice's own
// unguessable id is the access control (see /api/public/pay-invoice for the
// payment counterpart). Whitelists only what a payer needs to see; never
// contact info, property access instructions, pricing internals, or
// anything else attached to the shoot.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svc = db();

  const { data: invoice } = await svc
    .from("invoices")
    .select("id, amount_cents, paid, paid_at, due_date, line_items, description, shoot_id")
    .eq("id", id)
    .maybeSingle();
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  let shoot: {
    address: string; scheduled_at: string | null; services: string[] | null;
    square_footage: number | null; delivered_at: string | null;
  } | null = null;
  if (invoice.shoot_id) {
    const { data } = await svc
      .from("shoots")
      .select("address, scheduled_at, services, square_footage, delivered_at")
      .eq("id", invoice.shoot_id)
      .maybeSingle();
    shoot = data;
  }

  return NextResponse.json({
    id: invoice.id,
    amount_cents: invoice.amount_cents,
    paid: invoice.paid,
    paid_at: invoice.paid_at,
    due_date: invoice.due_date,
    line_items: invoice.line_items,
    description: invoice.description,
    shoot,
  });
}
