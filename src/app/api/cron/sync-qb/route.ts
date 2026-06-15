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

  const [plRes, invoicesRes] = await Promise.all([
    fetch(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/reports/ProfitAndLoss?start_date=${yearStart}&end_date=${today}&minorversion=70`,
      { headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" } }
    ),
    qbFetch(`/query?query=SELECT * FROM Invoice WHERE TxnDate >= '${yearStart}' ORDERBY TxnDate DESC MAXRESULTS 100`),
  ]);

  const [plData, invoicesData] = await Promise.all([plRes.json(), invoicesRes.json()]);

  // Parse P&L totals
  const rows = plData?.Rows?.Row || [];
  let revYTD = 0;
  let expenses = 0;
  for (const row of rows) {
    if (row.group === "Income" || row.type === "Section") {
      const total = row.Summary?.ColData?.[1]?.value;
      if (total && row.group === "Income") revYTD = parseFloat(total) || 0;
    }
    if (row.group === "Expenses") {
      const total = row.Summary?.ColData?.[1]?.value;
      if (total) expenses = parseFloat(total) || 0;
    }
  }

  // Parse invoices
  const invoices = invoicesData?.QueryResponse?.Invoice || [];
  const ytdInvoices = invoices.length;
  const unpaid = invoices.filter((i: { Balance: number }) => i.Balance > 0);
  const revMonth = invoices
    .filter((i: { TxnDate: string }) => i.TxnDate >= monthStart)
    .reduce((sum: number, i: { TotalAmt: number }) => sum + (i.TotalAmt || 0), 0);

  // Build monthly breakdown
  const monthly: Record<string, number> = {};
  for (const inv of invoices) {
    const month = inv.TxnDate?.substring(0, 7);
    if (month) monthly[month] = (monthly[month] || 0) + (inv.TotalAmt || 0);
  }

  // Store snapshot
  await supabase.from("kpi_snapshots").upsert({
    id: 1,
    rev_ytd: revYTD,
    rev_month: revMonth,
    expenses_ytd: expenses,
    net_income: revYTD - expenses,
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
