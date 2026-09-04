import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// GET  /api/admin/invoices — all invoices with shoot + contact joins
// PATCH /api/admin/invoices — mark an invoice paid manually (cash / check)
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  const { data: invoices, error } = await db
    .from("invoices")
    .select(`
      id, shoot_id, contact_id, amount_cents, line_items,
      description, due_date, paid, stripe_payment_intent_id,
      qbo_invoice_id, created_at,
      shoots:shoot_id ( address, scheduled_at, services ),
      contacts:contact_id ( name, email )
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invoices: invoices ?? [] });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { invoiceId } = await req.json();
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });

  const db = createAdminClient();

  const { error } = await db
    .from("invoices")
    .update({ paid: true })
    .eq("id", invoiceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: inv } = await db.from("invoices").select("description, amount_cents").eq("id", invoiceId).single();

  await db.from("company_updates").insert({
    message: `💵 Invoice marked paid manually — ${inv?.description ?? invoiceId} · $${((inv?.amount_cents ?? 0) / 100).toFixed(0)}`,
    created_by: "admin",
    category: "finance",
    link: "/dashboard/revenue",
  });

  return NextResponse.json({ ok: true });
}
