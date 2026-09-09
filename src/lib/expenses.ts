import { createClient as createServiceClient, SupabaseClient } from "@supabase/supabase-js";
import { r2Configured, r2StorageBytes } from "@/lib/r2";

// Builds the Revenue-app P&L. Nocturne is the source of truth: income is
// paid invoices, expenses are the manual operating budget plus three derived
// lines — Stripe fees (per paid invoice), gas (from the mileage tracker),
// and per-shoot editing cost.

export function expensesDb(): SupabaseClient {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const DEFAULT_STRIPE_PCT = 2.9;
const DEFAULT_STRIPE_FLAT_CENTS = 30;
const DEFAULT_IRS_RATE = 0.7;

export type ExpenseLine = {
  id: string;
  kind: "operating" | "stripe" | "gas" | "editing";
  category: string;
  label: string;
  amount_cents: number;          // as billed at its cadence (annual rows store the yearly total)
  monthly_cents?: number;        // effective monthly figure (annual ÷ 12) — what the P&L uses
  recurring?: boolean;
  cadence?: string;              // 'monthly' | 'annual' | 'fluctuates'
  auto_source?: string | null;   // 'twilio' | 'r2' | null
  note?: string | null;
  shoot_id?: string | null;
  editable: boolean;
};

export type Pnl = {
  scope: "month" | "ytd";
  month: string | null;            // "YYYY-MM" when scope === "month"
  income_cents: number;
  paid_invoice_count: number;
  expense_cents: number;
  profit_cents: number;
  by_category: { category: string; amount_cents: number }[];
  lines: ExpenseLine[];
  memo: {
    mileage_miles: number;
    mileage_deduction_cents: number;   // IRS standard-rate — reporting only, not in profit
    leif_profit_share_cents: number;   // 50% of profit
  };
};

type Range = { start: string; end: string; monthKey: string | null };

export function monthRange(month: string): Range {
  // month = "YYYY-MM"
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(y, m, 0).toISOString().slice(0, 10); // last day of month
  return { start, end, monthKey: month };
}

export function ytdRange(now = new Date()): Range {
  const y = now.getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31`, monthKey: null };
}

async function settings(db: SupabaseClient) {
  const { data } = await db
    .from("admin_settings")
    .select("key,value")
    .in("key", ["stripe_fee_percent", "stripe_fee_flat_cents", "irs_mileage_rate"]);
  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.key] = r.value;
  return {
    stripePct: parseFloat(map.stripe_fee_percent) || DEFAULT_STRIPE_PCT,
    stripeFlat: parseInt(map.stripe_fee_flat_cents) || DEFAULT_STRIPE_FLAT_CENTS,
    irsRate: parseFloat(map.irs_mileage_rate) || DEFAULT_IRS_RATE,
  };
}

export function stripeFeeCents(amountCents: number, pct: number, flatCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * (pct / 100)) + flatCents;
}

// Seed any recurring operating-expense series that don't yet have a row in
// the given month, copying from the most recent prior month.
export async function seedRecurringForMonth(db: SupabaseClient, month: string): Promise<void> {
  const firstOfMonth = `${month}-01`;

  const { data: templates } = await db
    .from("operating_expenses")
    .select("id, category, label, amount_cents, cadence, auto_source, note, recurring_source_id, incurred_on")
    .eq("recurring", true)
    .lt("incurred_on", firstOfMonth)
    .order("incurred_on", { ascending: false });

  if (!templates?.length) return;

  // One series per root id (a row is its own root unless it was itself seeded).
  const seriesRoot = (r: { id: string; recurring_source_id: string | null }) => r.recurring_source_id ?? r.id;
  const latestBySeries = new Map<string, typeof templates[number]>();
  for (const t of templates) {
    const root = seriesRoot(t);
    if (!latestBySeries.has(root)) latestBySeries.set(root, t);
  }

  const roots = [...latestBySeries.keys()];
  const { data: existing } = await db
    .from("operating_expenses")
    .select("recurring_source_id")
    .eq("incurred_on", firstOfMonth)
    .in("recurring_source_id", roots);
  const alreadySeeded = new Set((existing ?? []).map(r => r.recurring_source_id));

  const rows = [...latestBySeries.entries()]
    .filter(([root]) => !alreadySeeded.has(root))
    .map(([root, t]) => ({
      incurred_on: firstOfMonth,
      category: t.category,
      label: t.label,
      amount_cents: t.amount_cents,
      recurring: true,
      cadence: t.cadence ?? "monthly",
      auto_source: t.auto_source ?? null,
      note: t.note,
      recurring_source_id: root,
      created_by: "auto (recurring)",
    }));

  if (rows.length) await db.from("operating_expenses").insert(rows);
}

// ── Fluctuating line items: refresh amount from the live bill ──────────────

async function twilioMonthCents(month: string): Promise<number | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok) return null;
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(y, m, 0).toISOString().slice(0, 10);
  try {
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Usage/Records.json?Category=totalprice&StartDate=${start}&EndDate=${end}`,
      { headers: { Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64") } }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const total = (j.usage_records ?? []).reduce(
      (s: number, u: { price?: string }) => s + (parseFloat(u.price ?? "0") || 0),
      0
    );
    return Math.round(total * 100);
  } catch {
    return null;
  }
}

async function r2StorageCents(): Promise<number | null> {
  if (!r2Configured()) return null;
  try {
    const bytes = await r2StorageBytes();
    const gb = bytes / 1e9;
    const billableGb = Math.max(0, gb - 10); // 10 GB-month free allowance
    return Math.round(billableGb * 0.015 * 100);
  } catch {
    return null;
  }
}

// Update this month's auto-sourced rows (Twilio, R2) from their live bill.
// R2 is a live snapshot so it's only meaningful for the current month.
export async function refreshAutoExpenses(db: SupabaseClient, month: string, isCurrentMonth: boolean): Promise<void> {
  const { data: rows } = await db
    .from("operating_expenses")
    .select("id, auto_source")
    .eq("incurred_on", `${month}-01`)
    .not("auto_source", "is", null);

  for (const row of rows ?? []) {
    let cents: number | null = null;
    if (row.auto_source === "twilio") cents = await twilioMonthCents(month);
    else if (row.auto_source === "r2" && isCurrentMonth) cents = await r2StorageCents();
    if (cents != null) {
      await db.from("operating_expenses")
        .update({ amount_cents: cents, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }
}

export async function buildPnl(
  db: SupabaseClient,
  scope: "month" | "ytd",
  month?: string
): Promise<Pnl> {
  const now = new Date();
  const range = scope === "month" && month ? monthRange(month) : ytdRange(now);
  const { stripePct, stripeFlat, irsRate } = await settings(db);

  if (scope === "month" && month) {
    try { await seedRecurringForMonth(db, month); } catch (e) { console.error("seedRecurringForMonth failed", e); }
    const currentMonth = now.toISOString().slice(0, 7);
    try { await refreshAutoExpenses(db, month, month === currentMonth); } catch (e) { console.error("refreshAutoExpenses failed", e); }
  } else if (scope === "ytd") {
    const currentMonth = now.toISOString().slice(0, 7);
    try { await seedRecurringForMonth(db, currentMonth); } catch (e) { console.error("seedRecurringForMonth failed", e); }
    try { await refreshAutoExpenses(db, currentMonth, true); } catch (e) { console.error("refreshAutoExpenses failed", e); }
  }

  // ── Income + Stripe fees: from paid invoices in range (by paid_at, falling
  //    back to created_at for historical rows with no paid_at) ──────────────
  const { data: invoices } = await db
    .from("invoices")
    .select("id, shoot_id, amount_cents, paid, paid_at, created_at, description, shoots:shoot_id ( address )")
    .eq("paid", true);

  const inRange = (iso: string | null) => {
    if (!iso) return false;
    const d = iso.slice(0, 10);
    return d >= range.start && d <= range.end;
  };

  let incomeCents = 0;
  let paidCount = 0;
  const stripeLines: ExpenseLine[] = [];
  const paidInRange: { shoot_id: string | null; amount_cents: number; fee_cents: number }[] = [];
  for (const inv of invoices ?? []) {
    const when = inv.paid_at ?? inv.created_at;
    if (!inRange(when)) continue;
    incomeCents += inv.amount_cents ?? 0;
    paidCount++;
    const fee = stripeFeeCents(inv.amount_cents ?? 0, stripePct, stripeFlat);
    paidInRange.push({ shoot_id: inv.shoot_id, amount_cents: inv.amount_cents ?? 0, fee_cents: fee });
    if (fee > 0) {
      const addr = (inv.shoots as { address?: string } | null)?.address;
      stripeLines.push({
        id: `stripe:${inv.id}`,
        kind: "stripe",
        category: "Stripe fees",
        label: addr || inv.description || "Invoice",
        amount_cents: fee,
        shoot_id: inv.shoot_id,
        editable: false,
      });
    }
  }
  const stripeTotal = stripeLines.reduce((s, l) => s + l.amount_cents, 0);

  // ── Gas + mileage: from mileage_days in range ──────────────────────────────
  const { data: mdays } = await db
    .from("mileage_days")
    .select("day, effective_miles, gas_cost_cents, deduction_cents, shoot_ids")
    .gte("day", range.start)
    .lte("day", range.end);

  let gasCents = 0;
  let miles = 0;
  let deductionCents = 0;
  for (const d of mdays ?? []) {
    gasCents += d.gas_cost_cents ?? 0;
    miles += Number(d.effective_miles ?? 0);
    deductionCents += d.deduction_cents ?? Math.round(Number(d.effective_miles ?? 0) * irsRate * 100);
  }
  const gasLine: ExpenseLine[] = gasCents > 0 ? [{
    id: "gas:total",
    kind: "gas",
    category: "Gas (mileage)",
    label: `${miles.toFixed(0)} mi driven to & from shoots`,
    amount_cents: gasCents,
    note: "From the mileage tracker",
    editable: false,
  }] : [];

  // ── Editing: per-shoot editing cost, by the shoot's scheduled month ───────
  const { data: shoots } = await db
    .from("shoots")
    .select("id, address, scheduled_at, editing_cost_cents, editing_cost_by")
    .not("editing_cost_cents", "is", null)
    .gte("scheduled_at", `${range.start}T00:00:00`)
    .lte("scheduled_at", `${range.end}T23:59:59`);

  const editingLines: ExpenseLine[] = (shoots ?? [])
    .filter(s => (s.editing_cost_cents ?? 0) > 0)
    .map(s => ({
      id: `editing:${s.id}`,
      kind: "editing" as const,
      category: "Editing",
      label: s.address || "Shoot",
      amount_cents: s.editing_cost_cents as number,
      shoot_id: s.id,
      note: s.editing_cost_by ? `Logged by ${s.editing_cost_by}` : null,
      editable: false,
    }));
  const editingTotal = editingLines.reduce((s, l) => s + l.amount_cents, 0);

  // ── Operating budget: manual rows in range ───────────────────────────────
  const { data: ops } = await db
    .from("operating_expenses")
    .select("id, incurred_on, category, label, amount_cents, recurring, cadence, auto_source, note")
    .gte("incurred_on", range.start)
    .lte("incurred_on", range.end)
    .order("incurred_on", { ascending: true });

  const opLines: ExpenseLine[] = (ops ?? []).map(o => ({
    id: o.id,
    kind: "operating" as const,
    category: o.category || "other",
    label: o.label,
    amount_cents: o.amount_cents,
    monthly_cents: o.cadence === "annual" ? Math.round(o.amount_cents / 12) : o.amount_cents,
    recurring: o.recurring,
    cadence: o.cadence || "monthly",
    auto_source: o.auto_source,
    note: o.note,
    editable: true,
  }));
  const opsTotal = opLines.reduce((s, l) => s + (l.monthly_cents ?? l.amount_cents), 0);

  // ── Leif's commission: 50% of profit on shoots HE sourced ────────────────
  // Per the agreement, Leif gets 50% of profit only on shoots from a lead he
  // generated (contacts.sourced_by ~ "Leif"). Shoot-level profit = invoice −
  // that shoot's Stripe fee − editing − allocated gas. Company overhead (the
  // operating budget) is not netted against his shoots.
  let leifShareCents = 0;
  const shootIds = [...new Set(paidInRange.map(p => p.shoot_id).filter((v): v is string => !!v))];
  if (shootIds.length) {
    const [{ data: attrShoots }, { data: shootGas }] = await Promise.all([
      db.from("shoots").select("id, contact_id, editing_cost_cents").in("id", shootIds),
      db.from("shoot_mileage").select("shoot_id, allocated_gas_cents").in("shoot_id", shootIds),
    ]);
    const contactIds = [...new Set((attrShoots ?? []).map(s => s.contact_id).filter((v): v is string => !!v))];
    const { data: contacts } = contactIds.length
      ? await db.from("contacts").select("id, sourced_by").in("id", contactIds)
      : { data: [] as { id: string; sourced_by: string | null }[] };
    const sourcedBy = new Map((contacts ?? []).map(c => [c.id, (c.sourced_by || "").toLowerCase()]));
    const editingByShoot = new Map((attrShoots ?? []).map(s => [s.id, s.editing_cost_cents ?? 0]));
    const contactByShoot = new Map((attrShoots ?? []).map(s => [s.id, s.contact_id]));
    const gasByShoot = new Map<string, number>();
    for (const g of shootGas ?? []) gasByShoot.set(g.shoot_id, (gasByShoot.get(g.shoot_id) ?? 0) + (g.allocated_gas_cents ?? 0));

    let leifNet = 0;
    for (const p of paidInRange) {
      if (!p.shoot_id) continue;
      const cid = contactByShoot.get(p.shoot_id);
      if (!cid || !sourcedBy.get(cid)?.includes("leif")) continue;
      leifNet += p.amount_cents - p.fee_cents - (editingByShoot.get(p.shoot_id) ?? 0) - (gasByShoot.get(p.shoot_id) ?? 0);
    }
    leifShareCents = Math.max(0, Math.round(leifNet / 2));
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const expenseCents = stripeTotal + gasCents + editingTotal + opsTotal;
  const profitCents = incomeCents - expenseCents;

  const lines = [...opLines, ...gasLine, ...editingLines, ...stripeLines];
  const byCategoryMap = new Map<string, number>();
  for (const l of lines) byCategoryMap.set(l.category, (byCategoryMap.get(l.category) ?? 0) + (l.monthly_cents ?? l.amount_cents));
  const by_category = [...byCategoryMap.entries()]
    .map(([category, amount_cents]) => ({ category, amount_cents }))
    .sort((a, b) => b.amount_cents - a.amount_cents);

  return {
    scope,
    month: range.monthKey,
    income_cents: incomeCents,
    paid_invoice_count: paidCount,
    expense_cents: expenseCents,
    profit_cents: profitCents,
    by_category,
    lines,
    memo: {
      mileage_miles: Math.round(miles),
      mileage_deduction_cents: deductionCents,
      leif_profit_share_cents: leifShareCents,
    },
  };
}
