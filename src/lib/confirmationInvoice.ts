import { createClient as createServiceClient } from "@supabase/supabase-js";

export type LineItem = {
  label: string;
  amount_cents: number;
};

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Creates the invoice at shoot confirmation (pending → scheduled).
// Idempotent: skips if an invoice already exists for this shoot.
// Returns the invoice id, or null if nothing was created.
export async function createConfirmationInvoice(shootId: string): Promise<string | null> {
  const db = service();

  const { data: shoot } = await db
    .from("shoots")
    .select("id, address, price, line_items, contact_id, client_id")
    .eq("id", shootId)
    .single();
  if (!shoot) return null;

  // Idempotency guard — don't double-invoice if this fires more than once
  const { data: existing } = await db.from("invoices").select("id").eq("shoot_id", shootId).limit(1);
  if (existing && existing.length > 0) return existing[0].id;

  const lineItems: LineItem[] = shoot.line_items || [];
  const totalCents = lineItems.length > 0
    ? lineItems.reduce((sum: number, item: LineItem) => sum + item.amount_cents, 0)
    : shoot.price ? Math.round(shoot.price * 100) : 0;

  if (totalCents <= 0) {
    await db.from("company_updates").insert({
      message: `⚠️ ${shoot.address} confirmed with no price set — invoice not created. Add line items, then create the invoice manually.`,
      created_by: "system",
      category: "alerts",
      link: "/admin/shoots",
    });
    return null;
  }

  const { data: invoice, error } = await db.from("invoices").insert({
    shoot_id: shoot.id,
    client_id: shoot.client_id || null,
    contact_id: shoot.contact_id || null,
    amount_cents: totalCents,
    line_items: lineItems.length > 0 ? lineItems : null,
    description: `Luck Images — ${shoot.address}`,
    paid: false,
  }).select().single();

  if (error || !invoice) {
    console.error("createConfirmationInvoice: insert failed", error);
    return null;
  }

  const lineItemStr = lineItems
    .map((li: LineItem) => `${li.label} $${(li.amount_cents / 100).toFixed(0)}`)
    .join(" · ");

  await db.from("company_updates").insert({
    message: `🧾 Invoice created — ${shoot.address} · $${(totalCents / 100).toLocaleString()}${lineItemStr ? " (" + lineItemStr + ")" : ""}`,
    created_by: "system",
    category: "finance",
    link: "/admin/shoots",
  });

  return invoice.id;
}
