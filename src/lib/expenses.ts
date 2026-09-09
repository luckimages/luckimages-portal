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

export type ShootExpenseRow = {
  shoot_id: string;
  date: string;                 // shoot scheduled_at (ISO)
  address: string;              // condensed — first segment only
  client: string;
  stripe_cents: number;
  gas_cents: number;
  editing_cents: number;
  expense_cents: number;        // stripe + gas + editing
  revenue_cents: number;        // the shoot's invoice total
  revenue_paid: boolean;        // invoice(s) fully paid
  profit_cents: number;         // revenue − expense (expected until paid)
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
  shoot_expenses: ShootExpenseRow[];
  shoot_expense_cents: number;
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

  // ── Invoices (all) — income is the paid ones in range; unpaid ones still
  //    pull their shoot into the Shoot Expenses table ───────────────────────
  const { data: invoices } = await db
    .from("invoices")
    .select("id, shoot_id, amount_cents, paid, paid_at, created_at");

  const inRange = (iso: string | null) => {
    if (!iso) return false;
    const d = iso.slice(0, 10);
    return d >= range.start && d <= range.end;
  };

  let incomeCents = 0;
  let paidCount = 0;
  const paidInRange: { shoot_id: string | null; amount_cents: number; fee_cents: number }[] = [];
  // Shoots referenced by any invoice that shows in this month's view (paid or
  // created in range) — they must also appear in Shoot Expenses.
  const invoiceShootIds = new Set<string>();
  for (const inv of invoices ?? []) {
    const paidWhen = inv.paid && (inv.paid_at ?? inv.created_at);
    if (inv.paid && inRange(inv.paid_at ?? inv.created_at)) {
      incomeCents += inv.amount_cents ?? 0;
      paidCount++;
      paidInRange.push({
        shoot_id: inv.shoot_id,
        amount_cents: inv.amount_cents ?? 0,
        fee_cents: stripeFeeCents(inv.amount_cents ?? 0, stripePct, stripeFlat),
      });
    }
    if (inv.shoot_id && (inRange(inv.created_at) || (paidWhen && inRange(paidWhen)))) {
      invoiceShootIds.add(inv.shoot_id);
    }
  }

  // ── IRS mileage deduction (memo only) — from mileage_days in range ─────────
  const { data: mdays } = await db
    .from("mileage_days")
    .select("effective_miles, deduction_cents")
    .gte("day", range.start)
    .lte("day", range.end);

  let miles = 0;
  let deductionCents = 0;
  for (const d of mdays ?? []) {
    miles += Number(d.effective_miles ?? 0);
    deductionCents += d.deduction_cents ?? Math.round(Number(d.effective_miles ?? 0) * irsRate * 100);
  }

  // ── Shoot expenses: per-shoot Stripe fee + gas + editing, for every
  //    non-cancelled shoot scheduled in the month PLUS any shoot with an
  //    invoice in this month's view, ordered by date ─────────────────────────
  const { data: schedShoots } = await db
    .from("shoots")
    .select("id, address, scheduled_at, contact_id, editing_cost_cents, status")
    .gte("scheduled_at", `${range.start}T00:00:00`)
    .lte("scheduled_at", `${range.end}T23:59:59`)
    .neq("status", "cancelled");

  const haveIds = new Set((schedShoots ?? []).map(s => s.id));
  const extraIds = [...invoiceShootIds].filter(id => !haveIds.has(id));
  const { data: extraShoots } = extraIds.length
    ? await db.from("shoots").select("id, address, scheduled_at, contact_id, editing_cost_cents, status").in("id", extraIds)
    : { data: [] as NonNullable<typeof schedShoots> };

  const monthShoots = [...(schedShoots ?? []), ...(extraShoots ?? [])]
    .sort((a, b) => new Date(a.scheduled_at ?? 0).getTime() - new Date(b.scheduled_at ?? 0).getTime());

  const sIds = monthShoots.map(s => s.id);
  const sGasRes = sIds.length
    ? await db.from("shoot_mileage").select("shoot_id, allocated_gas_cents").in("shoot_id", sIds)
    : { data: [] as { shoot_id: string; allocated_gas_cents: number }[] };
  const cIds = [...new Set(monthShoots.map(s => s.contact_id).filter((v): v is string => !!v))];
  const { data: cRows } = cIds.length
    ? await db.from("contacts").select("id, name").in("id", cIds)
    : { data: [] as { id: string; name: string }[] };
  const nameByContact = new Map((cRows ?? []).map(c => [c.id, c.name]));

  const invByShoot = new Map<string, { total: number; paid: number }>();
  for (const inv of invoices ?? []) {
    if (!inv.shoot_id) continue;
    const cur = invByShoot.get(inv.shoot_id) ?? { total: 0, paid: 0 };
    cur.total += inv.amount_cents ?? 0;
    if (inv.paid) cur.paid += inv.amount_cents ?? 0;
    invByShoot.set(inv.shoot_id, cur);
  }
  const gasByShoot = new Map<string, number>();
  for (const g of sGasRes.data ?? []) gasByShoot.set(g.shoot_id, (gasByShoot.get(g.shoot_id) ?? 0) + (g.allocated_gas_cents ?? 0));

  const shoot_expenses: ShootExpenseRow[] = monthShoots.map(s => {
    const inv = invByShoot.get(s.id) ?? { total: 0, paid: 0 };
    const revenue = inv.total;
    const revenuePaid = inv.total > 0 && inv.paid >= inv.total;
    const stripe = stripeFeeCents(revenue, stripePct, stripeFlat);
    const gas = gasByShoot.get(s.id) ?? 0;
    const editing = s.editing_cost_cents ?? 0;
    const expense = stripe + gas + editing;
    return {
      shoot_id: s.id,
      date: s.scheduled_at,
      address: (s.address || "").split(",")[0].trim() || "—",
      client: (s.contact_id && nameByContact.get(s.contact_id)) || "—",
      stripe_cents: stripe,
      gas_cents: gas,
      editing_cents: editing,
      expense_cents: expense,
      revenue_cents: revenue,
      revenue_paid: revenuePaid,
      profit_cents: revenue - expense,
    };
  });

  const stripeTotal = shoot_expenses.reduce((s, r) => s + r.stripe_cents, 0);
  const gasTotal = shoot_expenses.reduce((s, r) => s + r.gas_cents, 0);
  const editingTotal = shoot_expenses.reduce((s, r) => s + r.editing_cents, 0);
  const shootExpenseTotal = shoot_expenses.reduce((s, r) => s + r.expense_cents, 0);

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
    const leifGasByShoot = new Map<string, number>();
    for (const g of shootGas ?? []) leifGasByShoot.set(g.shoot_id, (leifGasByShoot.get(g.shoot_id) ?? 0) + (g.allocated_gas_cents ?? 0));

    let leifNet = 0;
    for (const p of paidInRange) {
      if (!p.shoot_id) continue;
      const cid = contactByShoot.get(p.shoot_id);
      if (!cid || !sourcedBy.get(cid)?.includes("leif")) continue;
      leifNet += p.amount_cents - p.fee_cents - (editingByShoot.get(p.shoot_id) ?? 0) - (leifGasByShoot.get(p.shoot_id) ?? 0);
    }
    leifShareCents = Math.max(0, Math.round(leifNet / 2));
  }

  // ── Totals ───────────────────────────────────────────────────────────────
  const expenseCents = shootExpenseTotal + opsTotal;
  const profitCents = incomeCents - expenseCents;

  const lines = opLines;
  const byCategoryMap = new Map<string, number>();
  for (const l of lines) byCategoryMap.set(l.category, (byCategoryMap.get(l.category) ?? 0) + (l.monthly_cents ?? l.amount_cents));
  if (stripeTotal > 0) byCategoryMap.set("Stripe fees", stripeTotal);
  if (gasTotal > 0) byCategoryMap.set("Gas (mileage)", gasTotal);
  if (editingTotal > 0) byCategoryMap.set("Editing", editingTotal);
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
    shoot_expenses,
    shoot_expense_cents: shootExpenseTotal,
    memo: {
      mileage_miles: Math.round(miles),
      mileage_deduction_cents: deductionCents,
      leif_profit_share_cents: leifShareCents,
    },
  };
}
