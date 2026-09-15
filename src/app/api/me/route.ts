import { NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase-server";
import { buildPnl, monthRange } from "@/lib/expenses";

// "My Nocturne" — consolidated personal dashboard for an admin (Ryan or
// Leif): commission/earnings, shoots, mileage, cold-calling stats, and
// availability, all scoped to one person. Either admin can view either
// person's data (the page defaults to self, with a toggle).
//
// GET /api/me?person=ryan|leif&month=YYYY-MM

const PERSON_EMAIL: Record<string, string> = {
  ryan: "ryan@luckimages.com",
  leif: "leif@luckimages.com",
};
const PERSON_NAME: Record<string, string> = { ryan: "Ryan", leif: "Leif" };

// Leif's pay structure: a guaranteed Texas-minimum-wage draw against his
// 50%-of-profit commission. He's paid $7.25/hr for logged hours; if that
// month's commission exceeds the wage floor, he gets paid the commission
// instead (the wage is a floor, not a bonus on top).
const TX_MIN_WAGE_CENTS_PER_HOUR = 725;

// Semi-monthly payroll: paid the 1st and 15th, so periods are the 1st–15th
// and the 16th–end of each month. A period always falls inside one calendar
// month, which keeps it lined up with the existing (monthly) commission P&L.
type PayPeriod = { monthKey: string; half: 1 | 2 };

function parsePeriodParam(param: string | null): PayPeriod {
  const m = param?.match(/^(\d{4}-\d{2})-P([12])$/);
  if (m) return { monthKey: m[1], half: Number(m[2]) as 1 | 2 };
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return { monthKey, half: now.getDate() <= 15 ? 1 : 2 };
}

function periodKey(p: PayPeriod): string {
  return `${p.monthKey}-P${p.half}`;
}

function periodDates(p: PayPeriod): { start: string; end: string } {
  const [y, m] = p.monthKey.split("-").map(Number);
  if (p.half === 1) return { start: `${p.monthKey}-01`, end: `${p.monthKey}-15` };
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${p.monthKey}-16`, end: `${p.monthKey}-${String(lastDay).padStart(2, "0")}` };
}

function periodLabel(p: PayPeriod): string {
  const { start, end } = periodDates(p);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sameMonth = true; // periods never span months
  const s = new Date(`${start}T12:00:00`).toLocaleDateString("en-US", opts);
  const e = new Date(`${end}T12:00:00`).toLocaleDateString("en-US", sameMonth ? { day: "numeric", year: "numeric" } : opts);
  return `${s} – ${e}`;
}

function adjacentPeriod(p: PayPeriod, dir: -1 | 1): PayPeriod {
  if (dir === 1) {
    if (p.half === 1) return { monthKey: p.monthKey, half: 2 };
    const [y, m] = p.monthKey.split("-").map(Number);
    const d = new Date(y, m, 1);
    return { monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, half: 1 };
  }
  if (p.half === 2) return { monthKey: p.monthKey, half: 1 };
  const [y, m] = p.monthKey.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return { monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, half: 2 };
}

function weekStartOf(d: Date): Date {
  const w = new Date(d);
  w.setHours(0, 0, 0, 0);
  w.setDate(w.getDate() - w.getDay());
  return w;
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const person = (searchParams.get("person") || "").toLowerCase();
  if (!PERSON_EMAIL[person]) return NextResponse.json({ error: "person must be ryan or leif" }, { status: 400 });

  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const payPeriod = parsePeriodParam(searchParams.get("period"));
  const db = createAdminClient();

  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const personUser = users?.users.find(u => u.email?.toLowerCase() === PERSON_EMAIL[person]);
  const personId = personUser?.id ?? null;
  const personName = PERSON_NAME[person];

  const range = monthRange(month);

  // ── Commission / earnings ────────────────────────────────────────────────
  const pnl = await buildPnl(db, "month", month);
  const commission_cents = person === "leif" ? pnl.memo.leif_profit_share_cents : null;
  const personShootRows = person === "leif" ? pnl.shoot_expenses.filter(r => r.leif_sourced) : [];

  // ── Shoots photographed by this person ───────────────────────────────────
  const { data: shoots } = personId
    ? await db
        .from("shoots")
        .select("id, address, scheduled_at, status, price, package_name, photographer_ids")
        .contains("photographer_ids", [personId])
        .gte("scheduled_at", range.start)
        .lte("scheduled_at", range.end)
        .order("scheduled_at", { ascending: false })
    : { data: [] as { id: string; address: string; scheduled_at: string; status: string; price: number | null; package_name: string | null }[] };

  // ── Mileage ───────────────────────────────────────────────────────────────
  const { data: mileageDays } = personId
    ? await db
        .from("mileage_days")
        .select("day, effective_miles, gas_cost_cents, deduction_cents")
        .eq("photographer_id", personId)
        .gte("day", range.start.slice(0, 10))
        .lte("day", range.end.slice(0, 10))
        .order("day", { ascending: false })
    : { data: [] as { day: string; effective_miles: number; gas_cost_cents: number; deduction_cents: number }[] };
  const mileage = {
    days: mileageDays ?? [],
    total_miles: (mileageDays ?? []).reduce((s, d) => s + (d.effective_miles || 0), 0),
    total_gas_cents: (mileageDays ?? []).reduce((s, d) => s + (d.gas_cost_cents || 0), 0),
    total_deduction_cents: (mileageDays ?? []).reduce((s, d) => s + (d.deduction_cents || 0), 0),
  };

  // ── Cold calling / outreach ──────────────────────────────────────────────
  const { data: calls } = await db
    .from("cold_calls")
    .select("id, outcome, called_at, contact_id")
    .ilike("called_by", personName)
    .gte("called_at", range.start)
    .lte("called_at", range.end)
    .order("called_at", { ascending: false });
  const outcomeCounts: Record<string, number> = {};
  for (const c of calls ?? []) outcomeCounts[c.outcome || "unknown"] = (outcomeCounts[c.outcome || "unknown"] || 0) + 1;
  const cold_calling = {
    total_calls: (calls ?? []).length,
    by_outcome: outcomeCounts,
    recent: (calls ?? []).slice(0, 10),
  };

  // Leads this person sourced that turned into shoots this month (their pipeline impact)
  const { data: sourcedContacts } = personId
    ? await db.from("contacts").select("id").ilike("sourced_by", `%${personName}%`)
    : { data: [] as { id: string }[] };
  const sourced_leads_count = (sourcedContacts ?? []).length;

  // ── Availability blocks ──────────────────────────────────────────────────
  const { data: availability } = personId
    ? await db
        .from("availability_blocks")
        .select("id, user_id, user_name, all_day, start_at, end_at, note")
        .eq("user_id", personId)
        .gte("end_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(20)
    : { data: [] as { id: string; user_id: string; user_name: string; all_day: boolean; start_at: string; end_at: string; note: string | null }[] };

  // ── Time clock ────────────────────────────────────────────────────────────
  const { data: monthEntries } = personId
    ? await db
        .from("time_entries")
        .select("id, started_at, stopped_at, duration_seconds")
        .eq("user_id", personId)
        .gte("started_at", range.start)
        .lte("started_at", range.end)
        .order("started_at", { ascending: false })
    : { data: [] as { id: string; started_at: string; stopped_at: string | null; duration_seconds: number | null }[] };

  const { data: activeEntry } = personId
    ? await db.from("time_entries").select("id, started_at").eq("user_id", personId).is("stopped_at", null).maybeSingle()
    : { data: null as { id: string; started_at: string } | null };

  const nowMs = Date.now();
  const stoppedSeconds = (monthEntries ?? []).reduce((s, e) => s + (e.duration_seconds || 0), 0);
  const activeSeconds = activeEntry ? Math.floor((nowMs - new Date(activeEntry.started_at).getTime()) / 1000) : 0;
  const total_seconds = stoppedSeconds + activeSeconds;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const week_seconds = (monthEntries ?? [])
    .filter(e => new Date(e.started_at) >= weekStart)
    .reduce((s, e) => s + (e.duration_seconds || 0), 0)
    + (activeEntry && new Date(activeEntry.started_at) >= weekStart ? activeSeconds : 0);

  const hours = {
    active: activeEntry,
    month_seconds: total_seconds,
    week_seconds,
    entries: (monthEntries ?? []).slice(0, 14),
  };

  // ── Pay: guaranteed minimum wage draw against commission (Leif only) ──────
  const wage_floor_cents = person === "leif" ? Math.round((total_seconds / 3600) * TX_MIN_WAGE_CENTS_PER_HOUR) : null;
  const payout_cents = person === "leif" ? Math.max(wage_floor_cents ?? 0, commission_cents ?? 0) : null;

  // ── Semi-monthly pay period: hours per week, batched for payroll ──────────
  const periodDateRange = periodDates(payPeriod);
  const periodStartIso = `${periodDateRange.start}T00:00:00`;
  const periodEndIso = `${periodDateRange.end}T23:59:59`;

  const { data: periodEntries } = personId
    ? await db
        .from("time_entries")
        .select("id, started_at, stopped_at, duration_seconds")
        .eq("user_id", personId)
        .gte("started_at", periodStartIso)
        .lte("started_at", periodEndIso)
        .order("started_at", { ascending: true })
    : { data: [] as { id: string; started_at: string; stopped_at: string | null; duration_seconds: number | null }[] };

  const weekBuckets = new Map<string, { week_start: string; seconds: number }>();
  for (const e of periodEntries ?? []) {
    const started = new Date(e.started_at);
    const ws = toDateStr(weekStartOf(started));
    const secs = e.duration_seconds ?? (activeEntry?.id === e.id ? activeSeconds : 0);
    const bucket = weekBuckets.get(ws) ?? { week_start: ws, seconds: 0 };
    bucket.seconds += secs;
    weekBuckets.set(ws, bucket);
  }
  const weeks = [...weekBuckets.values()].sort((a, b) => a.week_start.localeCompare(b.week_start)).map(w => {
    const start = new Date(`${w.week_start}T12:00:00`);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return { ...w, label: `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}` };
  });
  const period_total_seconds = weeks.reduce((s, w) => s + w.seconds, 0);

  // Commission earned within the period's date range (same month as the
  // period, so the existing month P&L already has everything needed).
  const periodPnlShoots = payPeriod.monthKey === month ? personShootRows : (await buildPnl(db, "month", payPeriod.monthKey)).shoot_expenses.filter(r => r.leif_sourced);
  const periodCommissionCents = person === "leif"
    ? periodPnlShoots
        .filter(r => r.date >= periodStartIso && r.date <= periodEndIso && r.revenue_paid)
        .reduce((s, r) => s + Math.round(r.profit_cents / 2), 0)
    : null;
  const periodWageFloorCents = person === "leif" ? Math.round((period_total_seconds / 3600) * TX_MIN_WAGE_CENTS_PER_HOUR) : null;
  const periodPayoutCents = person === "leif" ? Math.max(periodWageFloorCents ?? 0, periodCommissionCents ?? 0) : null;

  const pay_period = {
    key: periodKey(payPeriod),
    label: periodLabel(payPeriod),
    start: periodDateRange.start,
    end: periodDateRange.end,
    prev_key: periodKey(adjacentPeriod(payPeriod, -1)),
    next_key: periodKey(adjacentPeriod(payPeriod, 1)),
    is_current: periodKey(payPeriod) === periodKey(parsePeriodParam(null)),
    weeks,
    total_seconds: period_total_seconds,
    wage_floor_cents: periodWageFloorCents,
    commission_cents: periodCommissionCents,
    payout_cents: periodPayoutCents,
  };

  return NextResponse.json({
    person,
    person_name: personName,
    month,
    commission_cents,
    commission_shoots: personShootRows,
    shoots: shoots ?? [],
    mileage,
    cold_calling,
    sourced_leads_count,
    availability: availability ?? [],
    hours,
    wage_floor_cents,
    payout_cents,
    pay_period,
    is_leif: person === "leif",
  });
}
