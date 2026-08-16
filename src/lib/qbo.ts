import { createClient } from "@supabase/supabase-js";

const QBO_API = "https://quickbooks.api.intuit.com/v3/company";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const MINOR_VER = "?minorversion=65";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function basicAuth() {
  return Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");
}

interface QboTokens {
  access_token: string;
  refresh_token: string;
  realm_id: string;
  expires_at: number; // unix ms
}

export function getAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com"}/api/admin/qbo/callback`,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    state,
  });
  return `https://appcenter.intuit.com/connect/oauth2?${params}`;
}

async function exchangeOrRefresh(params: Record<string, string>): Promise<QboTokens | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    realm_id: params.realm_id ?? "",
    expires_at: Date.now() + data.expires_in * 1000 - 60_000,
  };
}

export async function exchangeCode(code: string, realmId: string): Promise<QboTokens | null> {
  const tokens = await exchangeOrRefresh({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.luckimages.com"}/api/admin/qbo/callback`,
    realm_id: realmId,
  });
  if (tokens) tokens.realm_id = realmId;
  return tokens;
}

async function loadTokens(): Promise<QboTokens | null> {
  const db = adminDb();
  const { data } = await db.from("admin_settings").select("key,value").in("key", [
    "qbo_access_token", "qbo_refresh_token", "qbo_realm_id", "qbo_expires_at",
  ]);
  if (!data || data.length < 4) return null;
  const map = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]));
  if (!map.qbo_access_token || !map.qbo_realm_id) return null;
  return {
    access_token: map.qbo_access_token,
    refresh_token: map.qbo_refresh_token,
    realm_id: map.qbo_realm_id,
    expires_at: Number(map.qbo_expires_at),
  };
}

async function saveTokens(tokens: QboTokens) {
  const db = adminDb();
  const rows = [
    { key: "qbo_access_token", value: tokens.access_token },
    { key: "qbo_refresh_token", value: tokens.refresh_token },
    { key: "qbo_realm_id", value: tokens.realm_id },
    { key: "qbo_expires_at", value: String(tokens.expires_at) },
  ];
  await db.from("admin_settings").upsert(rows, { onConflict: "key" });
}

export async function getValidTokens(): Promise<QboTokens | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  if (Date.now() < tokens.expires_at) return tokens;

  // Refresh
  const fresh = await exchangeOrRefresh({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    realm_id: tokens.realm_id,
  });
  if (!fresh) return null;
  fresh.realm_id = tokens.realm_id;
  await saveTokens(fresh);
  return fresh;
}

export async function saveInitialTokens(tokens: QboTokens) {
  await saveTokens(tokens);
}

async function qboGet(path: string, tokens: QboTokens) {
  const res = await fetch(`${QBO_API}/${tokens.realm_id}/${path}${MINOR_VER}`, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`QBO GET ${path} failed: ${res.status}`);
  return res.json();
}

async function qboPost(path: string, body: unknown, tokens: QboTokens) {
  const res = await fetch(`${QBO_API}/${tokens.realm_id}/${path}${MINOR_VER}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QBO POST ${path} failed: ${res.status} ${err}`);
  }
  return res.json();
}

export async function findOrCreateCustomer(name: string, email: string, tokens: QboTokens): Promise<string> {
  const query = `select * from Customer where PrimaryEmailAddr = '${email.replace(/'/g, "\\'")}'`;
  const data = await qboGet(`query?query=${encodeURIComponent(query)}`, tokens);
  const existing = data?.QueryResponse?.Customer?.[0];
  if (existing) return existing.Id;

  const created = await qboPost("customer", {
    DisplayName: name,
    PrimaryEmailAddr: { Address: email },
  }, tokens);
  return created.Customer.Id;
}

interface LineItem {
  label: string;
  amount_cents: number;
}

const PRODUCT_IDS: Record<string, string> = {
  "Listing Photos": "8",
  "Twilight Photos": "6",
  "Floor Plan": "1010000021",
  "Virtual Staging": "7",
  "Aerial Photos": "27",
  "Video Walkthrough": "28",
  "Matterport 3D Tour": "29",
  "Headshots": "30",
  "Aerial Add-on": "31",
  "Twilight Add-on": "32",
};

export async function createQboInvoice(
  customerId: string,
  lineItems: LineItem[],
  dueDate: string,
  tokens: QboTokens
): Promise<string> {
  const lines = lineItems.map((li, i) => {
    const productId = PRODUCT_IDS[li.label];
    const amount = li.amount_cents / 100;
    return productId
      ? {
          Amount: amount,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef: { value: productId },
            UnitPrice: amount,
            Qty: 1,
          },
        }
      : {
          Amount: amount,
          DetailType: "SalesItemLineDetail",
          Description: li.label,
          LineNum: i + 1,
          SalesItemLineDetail: {
            ItemRef: { value: "1", name: "Services" },
            UnitPrice: amount,
            Qty: 1,
          },
        };
  });

  const data = await qboPost("invoice", {
    CustomerRef: { value: customerId },
    Line: lines,
    DueDate: dueDate,
  }, tokens);

  return data.Invoice.Id;
}

export async function recordQboPayment(
  qboInvoiceId: string,
  customerId: string,
  amountCents: number,
  tokens: QboTokens
): Promise<void> {
  const amount = amountCents / 100;
  await qboPost("payment", {
    TotalAmt: amount,
    CustomerRef: { value: customerId },
    Line: [{
      Amount: amount,
      LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: "Invoice" }],
    }],
  }, tokens);
}

export interface QboInvoiceSummary {
  id: string;
  docNumber: string;
  txnDate: string;
  totalAmt: number;
  balance: number; // 0 = fully paid
  customerName: string;
}

export async function fetchQboInvoices(tokens: QboTokens, year: number): Promise<QboInvoiceSummary[]> {
  const query = `select * from Invoice where TxnDate >= '${year}-01-01' ORDERBY TxnDate DESC MAXRESULTS 1000`;
  try {
    const data = await qboGet(`query?query=${encodeURIComponent(query)}`, tokens);
    const invoices: Array<Record<string, unknown>> = data?.QueryResponse?.Invoice ?? [];
    return invoices.map(inv => ({
      id: String(inv.Id),
      docNumber: String(inv.DocNumber ?? ""),
      txnDate: String(inv.TxnDate ?? ""),
      totalAmt: parseFloat(String(inv.TotalAmt ?? "0")) || 0,
      balance: parseFloat(String(inv.Balance ?? "0")) || 0,
      customerName: (inv.CustomerRef as Record<string, string>)?.name ?? "Unknown",
    }));
  } catch {
    return [];
  }
}

export async function fetchQboExpenses(tokens: QboTokens): Promise<{ expenses_ytd: number; net_income: number; rev_ytd: number }> {
  const year = new Date().getFullYear();
  const path = `reports/ProfitAndLoss?start_date=${year}-01-01&end_date=${year}-12-31&accounting_method=Accrual`;
  try {
    const data = await qboGet(path, tokens);
    const rows: Array<{ group?: string; Summary?: { ColData: Array<{ value: string }> } }> = data?.Rows?.Row ?? [];
    let revenue = 0;
    let expenses = 0;
    for (const row of rows) {
      const label = row.Summary?.ColData?.[0]?.value ?? "";
      const val = parseFloat(row.Summary?.ColData?.[1]?.value ?? "0") || 0;
      if (label.toLowerCase().includes("income")) revenue = val;
      if (label.toLowerCase().includes("expense")) expenses = val;
    }
    return { rev_ytd: revenue, expenses_ytd: expenses, net_income: revenue - expenses };
  } catch {
    return { rev_ytd: 0, expenses_ytd: 0, net_income: 0 };
  }
}
