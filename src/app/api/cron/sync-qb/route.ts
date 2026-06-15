import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.QB_CLIENT_ID!;
  const clientSecret = process.env.QB_CLIENT_SECRET!;

  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  return res.json();
}

export async function GET(req: Request) {
  // Protect cron endpoint
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get stored tokens
  const { data: tokenRow } = await supabase.from("qb_tokens").select("*").eq("id", 1).single();
  if (!tokenRow) return NextResponse.json({ error: "No QB tokens found. Visit /api/qb/connect first." }, { status: 400 });

  // Refresh access token
  const newTokens = await refreshAccessToken(tokenRow.refresh_token);
  const accessToken = newTokens.access_token;
  const realmId = tokenRow.realm_id;

  // Save refreshed tokens
  await supabase.from("qb_tokens").update({
    access_token: accessToken,
    refresh_token: newTokens.refresh_token || tokenRow.refresh_token,
    expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", 1);

  const qbFetch = (path: string) => fetch(
    `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}${path}?minorversion=70`,
    { headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" } }
  );

  // Pull P&L for current year
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const today = now.toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [plRes, plMonthlyRes, invoicesRes] = await Promise.all([
    fetch(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/reports/ProfitAndLoss?start_date=${yearStart}&end_date=${today}&minorversion=70`,
      { headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" } }
    ),
    fetch(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/reports/ProfitAndLoss?start_date=${yearStart}&end_date=${today}&summarize_column_by=Month&minorversion=70`,
      { headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" } }
    ),
    qbFetch(`/query?query=SELECT * FROM Invoice WHERE TxnDate >= '${yearStart}' ORDERBY TxnDate DESC MAXRESULTS 100`),
  ]);

  const [plData, plMonthlyData, invoicesData] = await Promise.all([plRes.json(), plMonthlyRes.json(), invoicesRes.json()]);

  // Parse P&L totals (single column)
  const rows = plData?.Rows?.Row || [];
  let revYTD = 0;
  for (const row of rows) {
    if (row.group === "Income") {
      const total = row.Summary?.ColData?.[1]?.value;
      if (total) revYTD = parseFloat(total) || 0;
    }
  }

  // Parse monthly P&L — columns are months, find Income row
  const monthCols: string[] = (plMonthlyData?.Columns?.Column || [])
    .slice(1) // skip label column
    .map((c: { ColTitle: string }) => c.ColTitle as string); // e.g. "Jan 2026"
  const monthlyRows = plMonthlyData?.Rows?.Row || [];
  const monthly: Record<string, number> = {};
  for (const row of monthlyRows) {
    if (row.group === "Income") {
      const colData: { value: string }[] = row.Summary?.ColData || [];
      colData.slice(1).forEach((cell, idx) => {
        const val = parseFloat(cell.value) || 0;
        if (val > 0 && monthCols[idx]) {
          // ColTitle is like "Jan 2026" — convert to "2026-01"
          const parts = monthCols[idx].split(" ");
          const monthNum = String(new Date(`${parts[0]} 1`).getMonth() + 1).padStart(2, "0");
          const year = parts[1] || String(now.getFullYear());
          monthly[`${year}-${monthNum}`] = val;
        }
      });
      break;
    }
  }

  // Current month revenue from monthly breakdown
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const revMonth = monthly[currentMonthKey] || 0;

  // Parse invoices
  const invoices = invoicesData?.QueryResponse?.Invoice || [];
  const ytdInvoices = invoices.length;
  const unpaid = invoices.filter((i: { Balance: number }) => i.Balance > 0);

  // Store snapshot
  await supabase.from("kpi_snapshots").upsert({
    id: 1,
    rev_ytd: revYTD,
    rev_month: revMonth,
    expenses_ytd: 0,
    net_income: revYTD,
    ytd_invoices: ytdInvoices,
    unpaid_count: unpaid.length,
    monthly_breakdown: monthly,
    recent_invoices: invoices.slice(0, 10).map((i: { DocNumber: string; CustomerRef: { name: string }; TxnDate: string; TotalAmt: number; Balance: number }) => ({
      num: i.DocNumber,
      client: i.CustomerRef?.name,
      date: i.TxnDate,
      amount: `$${i.TotalAmt?.toLocaleString()}`,
      paid: i.Balance === 0,
    })),
    synced_at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, revYTD, revMonth, ytdInvoices, synced_at: new Date().toISOString() });
}
