import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidTokens, fetchQboInvoices, fetchQboExpenses } from "@/lib/qbo";

export const maxDuration = 60;

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ skipped: true, reason: "QBO not connected" });
  }

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

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const snap = {
    rev_ytd,
    rev_month: monthly[thisMonthKey] ?? 0,
    expenses_ytd,
    net_income: rev_ytd - expenses_ytd,
    ytd_invoices,
    unpaid_count,
    monthly_breakdown: monthly,
    recent_invoices: qboInvoices.slice(0, 10).map(inv => ({
      num: `INV-${inv.docNumber}`,
      date: inv.txnDate,
      paid: inv.balance === 0,
      amount: `$${inv.totalAmt.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      client: inv.customerName,
    })),
    synced_at: now.toISOString(),
  };

  const db = service();
  await db.from("kpi_snapshots").upsert({ id: 1, ...snap });

  return NextResponse.json({ ok: true, ytd_invoices, rev_ytd });
}
