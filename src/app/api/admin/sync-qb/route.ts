import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import {
  getValidTokens,
  findOrCreateCustomer,
  createQboInvoice,
  recordQboPayment,
  fetchQboExpenses,
  fetchQboInvoices,
} from "@/lib/qbo";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tokens = await getValidTokens();
  return NextResponse.json({ connected: !!tokens });
}

export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const tokens = await getValidTokens();

  if (!tokens) {
    const { data: snap } = await db.from("kpi_snapshots").select("*").eq("id", 1).single();
    return NextResponse.json({ ...snap, connected: false });
  }

  // ── 1. Sync unsynced Nocturne invoices → QBO ──────────────────────────────
  const { data: unsyncedInvoices } = await db
    .from("invoices")
    .select("id, contact_id, line_items, amount_cents, paid, created_at")
    .is("qbo_invoice_id", null);

  for (const inv of unsyncedInvoices ?? []) {
    try {
      let name = "Unknown Client";
      let email = "";

      if (inv.contact_id) {
        const { data: contact } = await db
          .from("contacts")
          .select("name, email")
          .eq("id", inv.contact_id)
          .single();
        if (contact) { name = contact.name ?? name; email = contact.email ?? ""; }
      }

      if (!email) continue; // QBO requires a customer — skip if no email

      const customerId = await findOrCreateCustomer(name, email, tokens);

      const lineItems: Array<{ label: string; amount_cents: number }> =
        inv.line_items?.length ? inv.line_items : [{ label: "Real Estate Media", amount_cents: inv.amount_cents }];

      const dueDate = new Date(inv.created_at);
      dueDate.setDate(dueDate.getDate() + 14);
      const dueDateStr = dueDate.toISOString().split("T")[0];

      const qboInvoiceId = await createQboInvoice(customerId, lineItems, dueDateStr, tokens);

      if (inv.paid) {
        await recordQboPayment(qboInvoiceId, customerId, inv.amount_cents, tokens);
      }

      await db.from("invoices").update({ qbo_invoice_id: qboInvoiceId }).eq("id", inv.id);
    } catch (e) {
      console.error(`QBO sync failed for invoice ${inv.id}:`, e);
    }
  }

  // ── 2. Sync paid status for previously synced but unpaid invoices ──────────
  const { data: unpaidSynced } = await db
    .from("invoices")
    .select("id, contact_id, qbo_invoice_id, amount_cents")
    .not("qbo_invoice_id", "is", null)
    .eq("paid", true)
    .eq("qbo_payment_recorded", false);

  for (const inv of unpaidSynced ?? []) {
    try {
      let customerId = "";
      if (inv.contact_id) {
        const { data: contact } = await db.from("contacts").select("name,email").eq("id", inv.contact_id).single();
        if (contact?.email) {
          customerId = await findOrCreateCustomer(contact.name ?? "", contact.email, tokens);
        }
      }
      if (!customerId) continue;

      await recordQboPayment(inv.qbo_invoice_id, customerId, inv.amount_cents, tokens);
      await db.from("invoices").update({ qbo_payment_recorded: true }).eq("id", inv.id);
    } catch (e) {
      console.error(`QBO payment record failed for invoice ${inv.id}:`, e);
    }
  }

  // ── 3. Build revenue snapshot from QBO (source of truth for all invoices) ─
  const year = new Date().getFullYear();

  const [{ expenses_ytd }, qboInvoices] = await Promise.all([
    fetchQboExpenses(tokens),
    fetchQboInvoices(tokens, year),
  ]);

  let rev_ytd = 0;
  let ytd_invoices = 0;
  let unpaid_count = 0;
  const monthly: Record<string, number> = {};

  for (const inv of qboInvoices) {
    const paid = inv.balance === 0;
    if (paid) {
      rev_ytd += inv.totalAmt;
      ytd_invoices++;
      const key = inv.txnDate.slice(0, 7);
      monthly[key] = (monthly[key] ?? 0) + inv.totalAmt;
    } else {
      unpaid_count++;
    }
  }

  const recent_invoices = qboInvoices.slice(0, 10).map(inv => ({
    num: `INV-${inv.docNumber}`,
    date: inv.txnDate,
    paid: inv.balance === 0,
    amount: `$${inv.totalAmt.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
    client: inv.customerName,
  }));

  const snap = {
    rev_ytd,
    rev_month: monthly[`${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`] ?? 0,
    expenses_ytd,
    net_income: rev_ytd - expenses_ytd,
    ytd_invoices,
    unpaid_count,
    monthly_breakdown: monthly,
    recent_invoices,
    synced_at: new Date().toISOString(),
  };

  await db.from("kpi_snapshots").upsert({ id: 1, ...snap });

  return NextResponse.json({ ...snap, connected: true });
}
