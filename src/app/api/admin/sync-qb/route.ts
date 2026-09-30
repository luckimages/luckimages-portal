import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { getValidTokens, fetchQboExpenses, fetchQboInvoices } from "@/lib/qbo";

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

  // Nocturne/Stripe invoices no longer get pushed into QuickBooks — this used
  // to auto-create (and mark paid) real QBO invoices for every Nocturne
  // invoice just from loading the Revenue page, which produced invoices in
  // the live company nobody had actually sent. QBO is now read-only here:
  // we only pull existing data for the snapshot below. Invoices already
  // synced from before keep their qbo_invoice_id as historical record.

  // ── Build revenue snapshot from QBO (source of truth for pre-existing data) ─
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
