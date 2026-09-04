import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { getValidTokens } from "@/lib/qbo";

const QBO_API = "https://quickbooks.api.intuit.com/v3/company";

async function qboGet(path: string, tokens: { access_token: string; realm_id: string }) {
  const url = `${QBO_API}/${tokens.realm_id}/${path}${path.includes("?") ? "&" : "?"}minorversion=65`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`QBO ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

// Extract best address string from a QB invoice object
function extractAddress(inv: Record<string, unknown>): string {
  // CustomerMemo is the most common place Ryan stores the property address
  const memo = (inv.CustomerMemo as Record<string, string> | undefined)?.value ?? "";
  if (memo && memo.length > 5) return memo;

  // Fall back to line item descriptions
  const lines = (inv.Line as Array<Record<string, unknown>>) ?? [];
  for (const line of lines) {
    const desc = String(line.Description ?? "").trim();
    if (desc && desc.length > 5 && !desc.toLowerCase().includes("service")) return desc;
  }

  // Fall back to customer name
  return (inv.CustomerRef as Record<string, string> | undefined)?.name ?? "";
}

// Normalize an address string for fuzzy matching (strip to first street segment)
function normalizeAddr(addr: string): string {
  return addr.split(",")[0].toLowerCase().trim();
}

export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "QuickBooks not connected" }, { status: 400 });

  // ── 1. Delete old backfill invoices (no Stripe, no QB id) ──────────────
  const { error: delErr } = await db
    .from("invoices")
    .delete()
    .is("stripe_payment_intent_id", null)
    .is("qbo_invoice_id", null);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // ── 2. Fetch all QB invoices (no year filter, up to 1000) ──────────────
  const query = "SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS 1000";
  let qbInvoices: Array<Record<string, unknown>> = [];
  try {
    const data = await qboGet(`query?query=${encodeURIComponent(query)}`, tokens);
    qbInvoices = data?.QueryResponse?.Invoice ?? [];
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  // ── 3. Load shoots for address matching ───────────────────────────────
  const { data: shoots } = await db
    .from("shoots")
    .select("id, address, contact_id, client_id");

  const shootMap: Map<string, { id: string; contact_id: string | null; client_id: string | null }> = new Map();
  for (const s of shoots ?? []) {
    if (s.address) shootMap.set(normalizeAddr(s.address), s);
  }

  // ── 4. Load existing qbo_invoice_ids so we can skip dupes ─────────────
  const { data: existing } = await db
    .from("invoices")
    .select("qbo_invoice_id")
    .not("qbo_invoice_id", "is", null);

  const existingIds = new Set((existing ?? []).map(r => r.qbo_invoice_id));

  // ── 5. Import each QB invoice ─────────────────────────────────────────
  let created = 0;
  let skipped = 0;

  for (const inv of qbInvoices) {
    const qboId = String(inv.Id);
    if (existingIds.has(qboId)) { skipped++; continue; }

    const totalAmt = parseFloat(String(inv.TotalAmt ?? "0")) || 0;
    const balance  = parseFloat(String(inv.Balance  ?? "0")) || 0;
    if (totalAmt <= 0) { skipped++; continue; }

    const txnDate = String(inv.TxnDate ?? "").slice(0, 10); // YYYY-MM-DD
    const address = extractAddress(inv);
    const addrKey = normalizeAddr(address);

    // Try to match shoot by normalized address
    const matched = shootMap.get(addrKey);

    const { error: insErr } = await db.from("invoices").insert({
      qbo_invoice_id: qboId,
      shoot_id:   matched?.id       ?? null,
      contact_id: matched?.contact_id ?? null,
      client_id:  matched?.client_id  ?? null,
      amount_cents: Math.round(totalAmt * 100),
      description: address || `QB #${String(inv.DocNumber ?? qboId)}`,
      paid: balance === 0,
      created_at: txnDate ? `${txnDate}T12:00:00+00:00` : new Date().toISOString(),
    });

    if (insErr) { skipped++; continue; }
    created++;
  }

  await db.from("company_updates").insert({
    message: `📥 QB invoice import complete — ${created} invoices imported from QuickBooks, ${skipped} skipped (dupes / $0).`,
    created_by: "system",
    category: "finance",
    link: "/dashboard/revenue",
  });

  return NextResponse.json({ ok: true, created, skipped, total: qbInvoices.length });
}
