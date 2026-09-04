import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";

// POST /api/admin/backfill-invoices
// One-time job: creates a paid Supabase invoice for every historical shoot
// that has a price but no existing invoice. Safe to re-run — idempotent.
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  // All shoots that actually happened (not cancelled or scheduled), with a price
  const { data: shoots, error } = await db
    .from("shoots")
    .select("id, address, price, line_items, contact_id, client_id, scheduled_at, status")
    .not("status", "in", '("cancelled","scheduled")')
    .gt("price", 0)
    .order("scheduled_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Shoot ids that already have an invoice
  const { data: existing } = await db
    .from("invoices")
    .select("shoot_id")
    .not("shoot_id", "is", null);

  const alreadyHas = new Set((existing ?? []).map(r => r.shoot_id));

  const toCreate = (shoots ?? []).filter(s => !alreadyHas.has(s.id));

  let created = 0;
  let skipped = 0;

  for (const shoot of toCreate) {
    const lineItems: Array<{ label: string; amount_cents: number }> = shoot.line_items || [];
    const totalCents = lineItems.length > 0
      ? lineItems.reduce((sum: number, li: { label: string; amount_cents: number }) => sum + li.amount_cents, 0)
      : Math.round((shoot.price ?? 0) * 100);

    const { error: insErr } = await db.from("invoices").insert({
      shoot_id: shoot.id,
      contact_id: shoot.contact_id || null,
      client_id: shoot.client_id || null,
      amount_cents: totalCents,
      line_items: lineItems.length > 0 ? lineItems : null,
      description: `Luck Images — ${shoot.address}`,
      paid: true,
      created_at: shoot.scheduled_at || new Date().toISOString(),
    });

    if (insErr) { skipped++; continue; }
    created++;
  }

  await db.from("company_updates").insert({
    message: `📚 Invoice backfill complete — ${created} historical invoices created, ${skipped} skipped (no price or error).`,
    created_by: "system",
    category: "finance",
    link: "/dashboard/revenue",
  });

  return NextResponse.json({ ok: true, created, skipped, total: toCreate.length });
}
