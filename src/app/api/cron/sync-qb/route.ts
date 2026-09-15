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
    // This used to fail silently — the revenue dashboard would just quietly
    // go stale with nothing telling anyone the QBO connection had dropped.
    // Post to Command Center once so it surfaces same-day, not whenever
    // someone happens to notice the numbers look old.
    const db = service();
    const { data: last } = await db
      .from("company_updates")
      .select("id")
      .eq("category", "alerts")
      .eq("message", "⚠️ QuickBooks sync skipped — connection needs reauthorizing")
      .gte("created_at", new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString())
      .limit(1);
    if (!last?.length) {
      await db.from("company_updates").insert({
        message: "⚠️ QuickBooks sync skipped — connection needs reauthorizing",
        created_by: "system",
        category: "alerts",
        link: "/dashboard/revenue",
      });
    }
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
